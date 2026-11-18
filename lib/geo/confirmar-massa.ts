// Confirmação em massa dos postos cujo pino já confere com o endereço do Google. Servidor apenas.
//
// Critério: o pino atual (importado ou do GPS) está a até `limiteM` metros de uma sugestão do Google que seja
// precisa (ROOFTOP/RANGE_INTERPOLATED, sem correspondência parcial) e ainda vigente. Duas fontes independentes
// concordando. Só marca como conferido: não move nenhum ponto nem mexe no raio.

import { distanciaM } from '@/lib/agenda/geo'
import type { AnyClient } from './historico'

export const LIMITE_PADRAO_M = 50
export const LIMITE_MIN_M = 10
export const LIMITE_MAX_M = 100
const TIPOS_PRECISOS = new Set(['ROOFTOP', 'RANGE_INTERPOLATED'])

export type LinhaConfirmavel = {
  id: string
  nome: string
  latitude: number | null
  longitude: number | null
  geo_confirmado: boolean | null
  geo_google_lat: number | null
  geo_google_lng: number | null
  geo_google_tipo: string | null
  geo_google_parcial: boolean | null
  geo_google_expira_em: string | null
}

export type Confirmavel = { id: string; nome: string; distanciaM: number }

/** Quais postos a confirmação em massa atingiria. Função pura (testada). */
export function selecionarConfirmaveis(linhas: LinhaConfirmavel[], limiteM: number, agora: number = Date.now()): Confirmavel[] {
  const r: Confirmavel[] = []
  for (const p of linhas) {
    if (p.geo_confirmado === true) continue
    if (p.latitude == null || p.longitude == null) continue
    if (p.geo_google_lat == null || p.geo_google_lng == null) continue
    if (!p.geo_google_expira_em || Date.parse(p.geo_google_expira_em) <= agora) continue
    if (!TIPOS_PRECISOS.has(p.geo_google_tipo ?? '') || p.geo_google_parcial === true) continue
    const d = distanciaM(p.latitude, p.longitude, p.geo_google_lat, p.geo_google_lng)
    if (d <= limiteM) r.push({ id: p.id, nome: p.nome, distanciaM: Math.round(d) })
  }
  return r.sort((a, b) => a.distanciaM - b.distanciaM)
}

export function limiteValido(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= LIMITE_MIN_M && n <= LIMITE_MAX_M
}

const COLUNAS =
  'id, nome, latitude, longitude, geo_confirmado, geo_google_lat, geo_google_lng, geo_google_tipo, geo_google_parcial, geo_google_expira_em'

async function buscarLinhas(db: AnyClient): Promise<{ ok: true; linhas: LinhaConfirmavel[] } | { ok: false; erro: string }> {
  const linhas: LinhaConfirmavel[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db
      .from('postos')
      .select(COLUNAS)
      .eq('ativo', true)
      .not('nome', 'ilike', 'AFASTADO%')
      .order('nome')
      .range(de, de + 999)
    if (error) return { ok: false, erro: 'Recurso indisponível: aplique a migração 20261118_postos_geocodificacao.sql no Supabase Studio.' }
    linhas.push(...((data ?? []) as LinhaConfirmavel[]))
    if ((data ?? []).length < 1000) break
  }
  return { ok: true, linhas }
}

export async function previaConfirmacaoCore(db: AnyClient, limiteM: number) {
  const r = await buscarLinhas(db)
  if (!r.ok) return r
  const alvo = selecionarConfirmaveis(r.linhas, limiteM)
  return { ok: true as const, total: alvo.length, maisLonge: alvo.length ? alvo[alvo.length - 1].distanciaM : 0 }
}

export async function confirmarEmMassaCore(db: AnyClient, limiteM: number, usuarioId: string) {
  const r = await buscarLinhas(db)
  if (!r.ok) return r
  const alvo = selecionarConfirmaveis(r.linhas, limiteM)
  if (alvo.length === 0) return { ok: true as const, confirmados: 0 }

  const agora = new Date().toISOString()
  // `geo_confirmado = false` na condição: um posto que alguém confirmou/alterou no meio do caminho não é sobrescrito.
  const { data, error } = await db
    .from('postos')
    .update({ geo_confirmado: true, geo_status: 'confirmado', geo_confirmado_por: usuarioId, geo_confirmado_em: agora })
    .in('id', alvo.map(a => a.id))
    .eq('geo_confirmado', false)
    .select('id')
  if (error) return { ok: false as const, erro: 'Não foi possível confirmar agora. Nada foi alterado.' }

  const feitos = new Set(((data ?? []) as { id: string }[]).map(d => d.id))
  const eventos = alvo
    .filter(a => feitos.has(a.id))
    .map(a => ({
      posto_id: a.id,
      evento: 'confirmado_mapa',
      executado_por: usuarioId,
      detalhe: `confirmação em massa: pino a ${a.distanciaM} m do endereço do Google (limite ${limiteM} m)`,
    }))
  if (eventos.length > 0) {
    try { await db.from('postos_geo_historico').insert(eventos) } catch { /* histórico é complementar */ }
  }
  return { ok: true as const, confirmados: feitos.size }
}
