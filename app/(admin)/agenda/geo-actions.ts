'use server'

import { revalidatePath } from 'next/cache'
import { getUser } from '@/lib/auth/get-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { addDias, ehData, hojeBR, segundaDe } from '@/lib/agenda/datas'
import { coordenadaValida, distanciaM, PRECISAO_RUIM_M } from '@/lib/agenda/geo'
import { postosDoSupervisor } from '@/lib/agenda/postos'
import {
  dataBR, montarVisitas,
  type BlocoPlan, type CheckinRaw, type MapaStats, type PostoGeo, type VisitaView,
} from '@/lib/agenda/visitas'
import type { Periodo } from '@/lib/agenda/tema'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }
const db = () => createAdminClient() as unknown as AnyClient

function ehGestao(role: string | null | undefined) {
  return role === 'admin' || role === 'coordenador'
}

const MSG_MIGRACAO = 'Recurso indisponível: aplique a migração 20261012_agenda_checkins.sql no Supabase Studio.'

// ─── Localização dos postos (admin/coordenador) ───────────────────────────────

export type PostoLocal = {
  id: string
  nome: string
  secretaria: string | null
  latitude: number | null
  longitude: number | null
  raio_m: number
  endereco_ref: string | null
}

export async function listarLocais(): Promise<{ ok: true; postos: PostoLocal[] } | { ok: false; erro: string }> {
  const auth = await getUser()
  if (!auth || !ehGestao(auth.perfil.role)) return { ok: false, erro: 'Sem permissão' }
  const { data, error } = await db()
    .from('postos')
    .select('id, nome, secretaria, latitude, longitude, raio_m, endereco_ref')
    .not('nome', 'ilike', 'AFASTADO%') // grupos de afastados não são locais físicos
    .eq('ativo', true)
    .order('nome')
  if (error) return { ok: false, erro: MSG_MIGRACAO }
  return { ok: true, postos: (data ?? []) as PostoLocal[] }
}

export type ResultadoEndereco = { nome: string; lat: number; lng: number }

export async function buscarEndereco(q: string): Promise<{ ok: true; itens: ResultadoEndereco[] } | { ok: false; erro: string }> {
  const auth = await getUser()
  if (!auth || !ehGestao(auth.perfil.role)) return { ok: false, erro: 'Sem permissão' }
  const termo = q.trim().slice(0, 200)
  if (termo.length < 4) return { ok: false, erro: 'Digite ao menos 4 caracteres' }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=br&q=${encodeURIComponent(termo)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'demax-gestao/1.0 (gestao interna de contrato)', 'Accept-Language': 'pt-BR' },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (!res.ok) return { ok: false, erro: 'Serviço de busca indisponível. Clique no mapa para marcar.' }
    const json = (await res.json()) as { display_name: string; lat: string; lon: string }[]
    return {
      ok: true,
      itens: json.map(j => ({ nome: j.display_name, lat: Number(j.lat), lng: Number(j.lon) })).filter(i => coordenadaValida(i.lat, i.lng)),
    }
  } catch {
    return { ok: false, erro: 'Não foi possível buscar agora. Clique no mapa para marcar.' }
  }
}

export async function salvarLocalPosto(input: {
  postoId: string
  latitude: number | null
  longitude: number | null
  raioM: number
  enderecoRef: string
}): Promise<{ ok: true } | { ok: false; erro: string }> {
  const auth = await getUser()
  if (!auth || !ehGestao(auth.perfil.role)) return { ok: false, erro: 'Sem permissão' }

  const limpar = input.latitude === null || input.longitude === null
  if (!limpar && !coordenadaValida(input.latitude as number, input.longitude as number)) return { ok: false, erro: 'Coordenada inválida' }
  const raio = Math.round(input.raioM)
  if (!(raio >= 30 && raio <= 1000)) return { ok: false, erro: 'Raio deve ficar entre 30 e 1000 m' }

  const { error } = await db()
    .from('postos')
    .update({
      latitude: limpar ? null : input.latitude,
      longitude: limpar ? null : input.longitude,
      raio_m: raio,
      endereco_ref: input.enderecoRef.trim().slice(0, 300) || null,
    })
    .eq('id', input.postoId)
  if (error) return { ok: false, erro: error.message }

  revalidatePath('/agenda')
  revalidatePath('/agenda/locais')
  return { ok: true }
}

// ─── Check-in (supervisor) ────────────────────────────────────────────────────

export type ResultadoCheckin =
  | { ok: true; dentro: boolean; baixaPrecisao: boolean; distancia: number; checkinId: string }
  | { ok: false; erro: string; precisaJustificar?: boolean; distancia?: number; raio?: number }

export async function registrarCheckin(input: {
  postoId: string
  tipo: 'entrada' | 'saida'
  latitude: number
  longitude: number
  precisaoM: number | null
  justificativa?: string
}): Promise<ResultadoCheckin> {
  const auth = await getUser()
  if (!auth) return { ok: false, erro: 'Não autenticado' }
  if (auth.perfil.role !== 'supervisor' || auth.perfil.ativo === false) {
    return { ok: false, erro: 'Somente supervisores registram check-in' }
  }
  if (input.tipo !== 'entrada' && input.tipo !== 'saida') return { ok: false, erro: 'Tipo inválido' }
  if (!coordenadaValida(input.latitude, input.longitude)) return { ok: false, erro: 'Localização inválida' }

  const permitidos = await postosDoSupervisor(auth.perfil.id)
  if (!permitidos.some(p => p.id === input.postoId)) return { ok: false, erro: 'Posto não pertence ao supervisor' }

  const admin = db()
  const { data: posto, error: postoErr } = await admin
    .from('postos')
    .select('id, nome, latitude, longitude, raio_m')
    .eq('id', input.postoId)
    .maybeSingle()
  if (postoErr) return { ok: false, erro: MSG_MIGRACAO }
  if (!posto || posto.latitude == null || posto.longitude == null) {
    return { ok: false, erro: 'Este posto ainda não tem localização cadastrada. Peça à coordenação.' }
  }

  // Trava duplo toque / reenvio.
  const { data: ultimo } = await admin
    .from('agenda_checkins')
    .select('created_at')
    .eq('supervisor_id', auth.perfil.id)
    .eq('posto_id', input.postoId)
    .eq('tipo', input.tipo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (ultimo && Date.now() - Date.parse(ultimo.created_at) < 120_000) {
    return { ok: false, erro: 'Check-in já registrado há instantes.' }
  }

  const distancia = distanciaM(input.latitude, input.longitude, posto.latitude, posto.longitude)
  const raio = posto.raio_m ?? 150
  const dentro = distancia <= raio
  const baixa = input.precisaoM != null && input.precisaoM > PRECISAO_RUIM_M
  const justificativa = (input.justificativa ?? '').trim().slice(0, 300)

  if (!dentro && justificativa.length < 5) {
    return {
      ok: false,
      erro: 'Você está fora do raio do posto. Informe uma justificativa para registrar.',
      precisaJustificar: true,
      distancia,
      raio,
    }
  }

  // Vincula ao bloco planejado do dia (se houver).
  const hoje = hojeBR()
  const { data: blocosDia } = await admin
    .from('agenda_blocos')
    .select('id, agenda_semanas!inner(supervisor_id), agenda_blocos_postos!inner(posto_id)')
    .eq('data', hoje)
    .eq('agenda_semanas.supervisor_id', auth.perfil.id)
    .eq('agenda_blocos_postos.posto_id', input.postoId)
    .limit(1)
  const blocoId = ((blocosDia ?? []) as { id: string }[])[0]?.id ?? null

  const { data: criado, error } = await admin
    .from('agenda_checkins')
    .insert({
      supervisor_id: auth.perfil.id,
      posto_id: input.postoId,
      bloco_id: blocoId,
      tipo: input.tipo,
      latitude: input.latitude,
      longitude: input.longitude,
      precisao_m: input.precisaoM,
      distancia_m: Math.round(distancia),
      dentro_raio: dentro,
      baixa_precisao: baixa,
      justificativa: justificativa || null,
    })
    .select('id')
    .single()
  if (error) return { ok: false, erro: error.message }

  revalidatePath('/agenda')
  return { ok: true, dentro, baixaPrecisao: baixa, distancia, checkinId: criado.id as string }
}

// ─── Foto do check-in (opcional, temporária: apagada após 90 dias) ────────────

const BUCKET_FOTOS = 'agenda-checkins'
const MAX_FOTO_BYTES = 700_000

export async function anexarFotoCheckin(formData: FormData): Promise<{ ok: true } | { ok: false; erro: string }> {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'supervisor' || auth.perfil.ativo === false) {
    return { ok: false, erro: 'Somente o supervisor do check-in pode anexar foto' }
  }

  const checkinId = String(formData.get('checkinId') ?? '')
  const arquivo = formData.get('foto')
  if (!checkinId || !(arquivo instanceof Blob)) return { ok: false, erro: 'Dados inválidos' }
  if (arquivo.type !== 'image/jpeg') return { ok: false, erro: 'Formato inválido (use JPEG)' }
  if (arquivo.size === 0 || arquivo.size > MAX_FOTO_BYTES) return { ok: false, erro: 'Foto muito grande' }

  const admin = db()
  const { data: ck, error: ckErr } = await admin
    .from('agenda_checkins')
    .select('id, supervisor_id, foto_path, created_at')
    .eq('id', checkinId)
    .maybeSingle()
  if (ckErr) return { ok: false, erro: 'Recurso indisponível: aplique a migração 20261013_agenda_fotos.sql no Supabase Studio.' }
  if (!ck || ck.supervisor_id !== auth.perfil.id) return { ok: false, erro: 'Check-in não encontrado' }
  if (ck.foto_path) return { ok: false, erro: 'Este check-in já tem foto' }
  if (Date.now() - Date.parse(ck.created_at) > 24 * 3_600_000) return { ok: false, erro: 'Prazo para anexar foto expirou (24 h)' }

  const caminho = `${auth.perfil.id}/${checkinId}.jpg`
  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  const { error: upErr } = await createAdminClient().storage
    .from(BUCKET_FOTOS)
    .upload(caminho, bytes, { contentType: 'image/jpeg', upsert: true })
  if (upErr) return { ok: false, erro: 'Falha ao enviar a foto. Tente novamente.' }

  const { error } = await admin.from('agenda_checkins').update({ foto_path: caminho }).eq('id', checkinId)
  if (error) return { ok: false, erro: error.message }

  revalidatePath('/agenda')
  return { ok: true }
}

// ─── Mapa planejado × realizado ───────────────────────────────────────────────

export type MapaDados = {
  visitas: VisitaView[]
  stats: MapaStats
  semLocal: string[] // postos planejados sem coordenada
}

export async function carregarMapa(
  semanaInicio: string,
  supervisorId: string,
): Promise<{ ok: true; dados: MapaDados } | { ok: false; erro: string }> {
  const auth = await getUser()
  if (!auth) return { ok: false, erro: 'Não autenticado' }
  const dono = auth.perfil.role === 'supervisor' && auth.perfil.id === supervisorId
  if (!dono && !ehGestao(auth.perfil.role)) return { ok: false, erro: 'Sem permissão' }
  if (!ehData(semanaInicio) || segundaDe(semanaInicio) !== semanaInicio) return { ok: false, erro: 'Semana inválida' }

  const admin = db()
  const fim = addDias(semanaInicio, 6)

  const { data: sem } = await admin
    .from('agenda_semanas')
    .select('id, status')
    .eq('supervisor_id', supervisorId)
    .eq('semana_inicio', semanaInicio)
    .maybeSingle()

  type BlRaw = {
    data: string
    periodo: Periodo
    agenda_tipos_foco: { nome: string; exige_foto?: boolean } | null
    agenda_blocos_postos: { posto_id: string }[]
  }
  let planos: BlocoPlan[] = []
  if (sem) {
    const buscarBlocos = (foco: string) =>
      admin
        .from('agenda_blocos')
        .select(`data, periodo, agenda_tipos_foco(${foco}), agenda_blocos_postos(posto_id)`)
        .eq('semana_id', sem.id)
    // exige_foto só existe após a migração 20261015.
    let { data: bl, error: blErr } = await buscarBlocos('nome, exige_foto')
    if (blErr) ({ data: bl, error: blErr } = await buscarBlocos('nome'))
    planos = ((bl ?? []) as BlRaw[]).flatMap(b =>
      b.agenda_blocos_postos.map(p => ({
        data: b.data,
        periodo: b.periodo,
        foco: b.agenda_tipos_foco?.nome ?? '',
        posto_id: p.posto_id,
        exige_foto: !!b.agenda_tipos_foco?.exige_foto,
      })),
    )
  }

  const colunas = 'id, supervisor_id, posto_id, tipo, latitude, longitude, precisao_m, distancia_m, dentro_raio, baixa_precisao, justificativa, created_at'
  const buscarCheckins = (cols: string) =>
    admin
      .from('agenda_checkins')
      .select(cols)
      .eq('supervisor_id', supervisorId)
      .gte('created_at', `${addDias(semanaInicio, -1)}T00:00:00Z`)
      .lte('created_at', `${addDias(fim, 1)}T23:59:59Z`)
      .order('created_at', { ascending: true })
  // Com foto_path; se a migração 20261013 ainda não rodou, cai para o select sem a coluna.
  let { data: cksRaw, error: cksErr } = await buscarCheckins(`${colunas}, foto_path`)
  if (cksErr) ({ data: cksRaw, error: cksErr } = await buscarCheckins(colunas))
  if (cksErr) return { ok: false, erro: MSG_MIGRACAO }
  const checkins = ((cksRaw ?? []) as CheckinRaw[]).filter(c => {
    const d = dataBR(c.created_at)
    return d >= semanaInicio && d <= fim
  })

  const ids = Array.from(new Set([...planos.map(p => p.posto_id), ...checkins.map(c => c.posto_id)]))
  const postos = new Map<string, PostoGeo>()
  if (ids.length > 0) {
    const { data: ps } = await admin.from('postos').select('id, nome, latitude, longitude, raio_m').in('id', ids)
    for (const p of (ps ?? []) as PostoGeo[]) postos.set(p.id, { ...p, raio_m: p.raio_m ?? 150 })
  }

  // Histórico (30 dias antes da semana) só para detectar coordenada repetida.
  const buscarHist = (cols: string) =>
    admin
      .from('agenda_checkins')
      .select(cols)
      .eq('supervisor_id', supervisorId)
      .gte('created_at', `${addDias(semanaInicio, -31)}T00:00:00Z`)
      .lt('created_at', `${addDias(semanaInicio, -1)}T23:59:59Z`)
  const comFoto = await buscarHist(`${colunas}, foto_path`)
  const histRaw = comFoto.error ? (await buscarHist(colunas)).data : comFoto.data
  const historico = ((histRaw ?? []) as CheckinRaw[]).filter(c => dataBR(c.created_at) < semanaInicio)

  const { visitas, stats } = montarVisitas({
    planos, checkins, historico, postos, hoje: hojeBR(), publicada: sem?.status === 'publicada',
  })

  // Fotos: troca o caminho no bucket privado por URL assinada (1 h).
  const caminhos = Array.from(new Set(visitas.flatMap(v => v.fotos)))
  if (caminhos.length > 0) {
    const { data: urls } = await createAdminClient().storage.from(BUCKET_FOTOS).createSignedUrls(caminhos, 3600)
    const porCaminho = new Map<string, string>()
    for (const u of urls ?? []) if (u.path && u.signedUrl) porCaminho.set(u.path, u.signedUrl)
    for (const v of visitas) v.fotos = v.fotos.map(c => porCaminho.get(c)).filter((u): u is string => !!u)
  }

  const semLocal = Array.from(postos.values())
    .filter(p => p.latitude == null || p.longitude == null)
    .map(p => p.nome)
    .sort((a, b) => a.localeCompare(b))

  return { ok: true, dados: { visitas, stats, semLocal } }
}
