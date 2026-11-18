'use server'

import { revalidatePath } from 'next/cache'
import { getUser } from '@/lib/auth/get-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { coordenadaValida } from '@/lib/agenda/geo'
import { limparEnderecoBusca } from '@/lib/geo/endereco'
import {
  geocodificarPostoCore, persistirCandidato,
  type CandidatoView, type SaidaGeocodificacao,
} from '@/lib/geo/geocodificar-posto'
import type { AnyClient } from '@/lib/geo/historico'

export type { CandidatoView, SaidaGeocodificacao }

const db = () => createAdminClient() as unknown as AnyClient

function ehGestao(role: string | null | undefined) {
  return role === 'admin' || role === 'coordenador'
}

/**
 * Consulta o Google para o endereço do posto (admin/coordenador). Sem `forcar`, reaproveita o resultado guardado
 * quando o endereço não mudou. `forcar` = "Revalidar" manual.
 */
export async function geocodificarPosto(input: {
  postoId: string
  endereco?: string
  forcar?: boolean
}): Promise<SaidaGeocodificacao> {
  const auth = await getUser()
  if (!auth || !ehGestao(auth.perfil.role)) return { ok: false, motivo: 'posto', erro: 'Sem permissão' }
  const r = await geocodificarPostoCore(db(), input.postoId, {
    usuarioId: auth.perfil.id,
    endereco: input.endereco,
    forcar: input.forcar === true,
  })
  if (r.ok || r.motivo === 'sem_endereco' || r.motivo === 'nao_encontrado') {
    revalidatePath('/agenda/locais')
  }
  return r
}

/** A coordenação escolhe um dos candidatos de um resultado ambíguo. Vira sugestão (30 dias), não o ponto oficial. */
export async function escolherCandidatoGoogle(input: {
  postoId: string
  candidato: { lat: number; lng: number; enderecoFormatado: string; placeId: string; tipo: string; parcial: boolean }
}): Promise<{ ok: true } | { ok: false; erro: string }> {
  const auth = await getUser()
  if (!auth || !ehGestao(auth.perfil.role)) return { ok: false, erro: 'Sem permissão' }
  const c = input.candidato
  if (!c || !c.placeId || !coordenadaValida(c.lat, c.lng)) return { ok: false, erro: 'Candidato inválido' }

  const admin = db()
  const { data: posto, error } = await admin
    .from('postos')
    .select('id, latitude, longitude, endereco_busca')
    .eq('id', input.postoId)
    .maybeSingle()
  if (error) return { ok: false, erro: 'Recurso indisponível: aplique a migração 20261118_postos_geocodificacao.sql no Supabase Studio.' }
  if (!posto) return { ok: false, erro: 'Posto não encontrado' }
  const endereco = limparEnderecoBusca(posto.endereco_busca ?? '')
  if (endereco.length < 5) return { ok: false, erro: 'Informe o endereço do posto antes de escolher.' }

  const r = await persistirCandidato(
    admin, posto,
    { lat: c.lat, lng: c.lng, enderecoFormatado: String(c.enderecoFormatado ?? ''), placeId: String(c.placeId), tipo: String(c.tipo ?? 'APPROXIMATE'), parcial: c.parcial === true, cidade: null, uf: null },
    endereco, auth.perfil.id, 'candidato escolhido pela coordenação',
  )
  if (r.ok) revalidatePath('/agenda/locais')
  return r
}

export type EventoHistoricoGeo = {
  id: string
  evento: string
  origem: string | null
  statusGeo: string | null
  detalhe: string | null
  usuarioNome: string | null
  criadoEm: string
}

export async function listarHistoricoGeo(postoId: string): Promise<{ ok: true; eventos: EventoHistoricoGeo[] } | { ok: false; erro: string }> {
  const auth = await getUser()
  if (!auth || !ehGestao(auth.perfil.role)) return { ok: false, erro: 'Sem permissão' }
  const { data, error } = await db()
    .from('postos_geo_historico')
    .select('id, evento, origem, status_geo, detalhe, created_at, perfis:executado_por(nome)')
    .eq('posto_id', postoId)
    .order('created_at', { ascending: false })
    .limit(15)
  if (error) return { ok: false, erro: 'Histórico indisponível: aplique a migração 20261118_postos_geocodificacao.sql.' }
  type Raw = { id: string; evento: string; origem: string | null; status_geo: string | null; detalhe: string | null; created_at: string; perfis: { nome: string | null } | null }
  return {
    ok: true,
    eventos: ((data ?? []) as Raw[]).map(r => ({
      id: r.id, evento: r.evento, origem: r.origem, statusGeo: r.status_geo, detalhe: r.detalhe,
      usuarioNome: r.perfis?.nome ?? null, criadoEm: r.created_at,
    })),
  }
}
