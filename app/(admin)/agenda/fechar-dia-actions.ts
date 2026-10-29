'use server'

import { revalidatePath } from 'next/cache'
import { getUser } from '@/lib/auth/get-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { addDias, hojeBR, segundaDe } from '@/lib/agenda/datas'
import { dataBR } from '@/lib/agenda/visitas'
import { DIAS_PARA_JUSTIFICAR, exigeTextoJustificativa, TIPOS_JUSTIFICATIVA } from '@/lib/agenda/justificativas'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }
const db = () => createAdminClient() as unknown as AnyClient

const MSG_MIGRACAO = 'Recurso indisponível: aplique a migração 20261103_agenda_justificativas_falta.sql no Supabase Studio.'

export type PendenciaDia = { semanaId: string; data: string; postoId: string; postoNome: string; foco: string }

type Calculo = { ok: true; pendencias: PendenciaDia[] } | { ok: false; indisponivel: true }

/**
 * Visitas planejadas (agenda publicada, foco com posto) dos últimos dias e de hoje, sem check-in de entrada
 * e ainda sem justificativa. Base do "Fechar o dia".
 */
async function calcularPendencias(admin: AnyClient, supervisorId: string): Promise<Calculo> {
  const hoje = hojeBR()
  const desde = addDias(hoje, -DIAS_PARA_JUSTIFICAR)

  const { data: semanas } = await admin
    .from('agenda_semanas')
    .select('id')
    .eq('supervisor_id', supervisorId)
    .eq('status', 'publicada')
    .gte('semana_inicio', segundaDe(desde))
    .lte('semana_inicio', hoje)
  const semanaIds = ((semanas ?? []) as { id: string }[]).map(s => s.id)
  if (semanaIds.length === 0) return { ok: true, pendencias: [] }

  const { data: blocos } = await admin
    .from('agenda_blocos')
    .select('semana_id, data, agenda_tipos_foco(nome, sem_posto), agenda_blocos_postos(posto_id, postos(nome))')
    .in('semana_id', semanaIds)
    .gte('data', desde)
    .lte('data', hoje)
  type Bl = {
    semana_id: string
    data: string
    agenda_tipos_foco: { nome: string; sem_posto: boolean | null } | null
    agenda_blocos_postos: { posto_id: string; postos: { nome: string } | null }[]
  }
  const planejadas = new Map<string, PendenciaDia>()
  for (const b of (blocos ?? []) as Bl[]) {
    if (b.agenda_tipos_foco?.sem_posto) continue // foco administrativo não tem visita a posto
    for (const p of b.agenda_blocos_postos) {
      const k = `${b.data}|${p.posto_id}`
      if (!planejadas.has(k)) {
        planejadas.set(k, { semanaId: b.semana_id, data: b.data, postoId: p.posto_id, postoNome: p.postos?.nome ?? 'Posto', foco: b.agenda_tipos_foco?.nome ?? '' })
      }
    }
  }

  const { data: cks } = await admin
    .from('agenda_checkins')
    .select('posto_id, created_at')
    .eq('supervisor_id', supervisorId)
    .eq('tipo', 'entrada')
    .gte('created_at', `${addDias(desde, -1)}T00:00:00Z`)
  const feitas = new Set(((cks ?? []) as { posto_id: string; created_at: string }[]).map(c => `${dataBR(c.created_at)}|${c.posto_id}`))

  const { data: justs, error: errJust } = await admin
    .from('agenda_justificativas_falta')
    .select('data, posto_id')
    .in('semana_id', semanaIds)
  if (errJust) return { ok: false, indisponivel: true }
  const justificadas = new Set(((justs ?? []) as { data: string; posto_id: string }[]).map(j => `${j.data}|${j.posto_id}`))

  const pendencias = Array.from(planejadas.entries())
    .filter(([k]) => !feitas.has(k) && !justificadas.has(k))
    .map(([, v]) => v)
    .sort((a, b) => a.data.localeCompare(b.data) || a.postoNome.localeCompare(b.postoNome))
  return { ok: true, pendencias }
}

/** Visitas planejadas sem check-in e sem justificativa do próprio supervisor. Vazio se não houver (ou sem migração). */
export async function listarPendenciasDia(): Promise<PendenciaDia[]> {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'supervisor' || auth.perfil.ativo === false) return []
  if ((auth.perfil as { apoio?: boolean | null }).apoio === true) return [] // apoio não tem agenda
  const r = await calcularPendencias(db(), auth.perfil.id)
  return r.ok ? r.pendencias : []
}

export type JustificativaInput = { data: string; postoId: string; tipo: string; texto?: string }

/** Grava as justificativas do "Fechar o dia". Só vale para visitas que ainda estão pendentes. */
export async function registrarJustificativas(itens: JustificativaInput[]): Promise<{ ok: true; gravadas: number } | { ok: false; erro: string }> {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'supervisor' || auth.perfil.ativo === false) return { ok: false, erro: 'Somente o supervisor justifica as próprias visitas' }
  if (!Array.isArray(itens) || itens.length === 0) return { ok: false, erro: 'Nada para enviar' }
  if (itens.length > 60) return { ok: false, erro: 'Itens demais de uma vez' }

  const admin = db()
  const calc = await calcularPendencias(admin, auth.perfil.id)
  if (!calc.ok) return { ok: false, erro: MSG_MIGRACAO }
  const pendentes = new Map(calc.pendencias.map(p => [`${p.data}|${p.postoId}`, p]))

  const tiposValidos = new Set<string>(TIPOS_JUSTIFICATIVA.map(t => t.id))
  const linhas: Record<string, unknown>[] = []
  for (const i of itens) {
    const p = pendentes.get(`${i.data}|${i.postoId}`)
    if (!p) continue // já justificada, já feita ou fora do prazo: ignora
    if (!tiposValidos.has(i.tipo)) return { ok: false, erro: 'Motivo inválido' }
    const texto = (i.texto ?? '').trim().slice(0, 300)
    if (exigeTextoJustificativa(i.tipo) && texto.length < 5) {
      return { ok: false, erro: `Descreva o que aconteceu em ${p.postoNome} (ao menos 5 caracteres).` }
    }
    linhas.push({ semana_id: p.semanaId, data: p.data, posto_id: p.postoId, supervisor_id: auth.perfil.id, tipo: i.tipo, texto: texto || null })
  }
  if (linhas.length === 0) return { ok: false, erro: 'Essas visitas já foram justificadas ou saíram do prazo.' }

  const { error } = await admin.from('agenda_justificativas_falta').upsert(linhas, { onConflict: 'semana_id,data,posto_id', ignoreDuplicates: true })
  if (error) return { ok: false, erro: MSG_MIGRACAO }
  revalidatePath('/agenda')
  return { ok: true, gravadas: linhas.length }
}
