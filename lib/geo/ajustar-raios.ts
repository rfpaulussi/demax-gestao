// Ajuste em lote do raio de check-in dos postos. Servidor apenas.
//
// Hoje quase todos os postos estão com raio de 500 m (o máximo do controle), o que deixa o check-in frouxo:
// com a tolerância do GPS (até +100 m) o supervisor passa como "dentro" a até 600 m do posto.
// Regra: só mexe em posto com ponto JÁ CONFIRMADO e raio >= 500 m (valor padrão da importação, não ajustado à mão).
// Raios menores que 500 m, escolhidos por uma pessoa, nunca são alterados. Postos "a conferir" ficam de fora:
// com um ponto ainda duvidoso, um raio pequeno geraria falsos "fora do raio".

import type { AnyClient } from './historico'

export const RAIO_IMPORTADO_M = 500
export const RAIOS_ALVO_M = [100, 150, 200, 250] as const
export const RAIO_ALVO_PADRAO_M = 150

export type LinhaRaio = {
  id: string
  nome: string
  latitude: number | null
  longitude: number | null
  geo_confirmado: boolean | null
  raio_m: number | null
}

export function raioAlvoValido(n: unknown): n is number {
  return typeof n === 'number' && (RAIOS_ALVO_M as readonly number[]).includes(n)
}

/** Postos que o ajuste atingiria. Função pura (testada). */
export function selecionarParaAjuste(linhas: LinhaRaio[], alvoM: number): { id: string; nome: string; raioAtual: number }[] {
  const r: { id: string; nome: string; raioAtual: number }[] = []
  for (const p of linhas) {
    if (p.geo_confirmado !== true) continue
    if (p.latitude == null || p.longitude == null) continue
    if (p.raio_m == null || p.raio_m < RAIO_IMPORTADO_M || p.raio_m <= alvoM) continue
    r.push({ id: p.id, nome: p.nome, raioAtual: p.raio_m })
  }
  return r
}

const COLUNAS = 'id, nome, latitude, longitude, geo_confirmado, raio_m'

async function buscarLinhas(db: AnyClient): Promise<{ ok: true; linhas: LinhaRaio[] } | { ok: false; erro: string }> {
  const linhas: LinhaRaio[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db
      .from('postos')
      .select(COLUNAS)
      .eq('ativo', true)
      .not('nome', 'ilike', 'AFASTADO%')
      .order('nome')
      .range(de, de + 999)
    if (error) return { ok: false, erro: 'Não foi possível ler os postos agora.' }
    linhas.push(...((data ?? []) as LinhaRaio[]))
    if ((data ?? []).length < 1000) break
  }
  return { ok: true, linhas }
}

export async function previaAjusteRaiosCore(db: AnyClient, alvoM: number) {
  const r = await buscarLinhas(db)
  if (!r.ok) return r
  const alvo = selecionarParaAjuste(r.linhas, alvoM)
  const aConferirGrandes = r.linhas.filter(p => p.geo_confirmado !== true && p.latitude != null && (p.raio_m ?? 0) >= RAIO_IMPORTADO_M).length
  return { ok: true as const, total: alvo.length, aConferirGrandes }
}

export async function ajustarRaiosCore(db: AnyClient, alvoM: number, usuarioId: string) {
  const r = await buscarLinhas(db)
  if (!r.ok) return r
  const alvo = selecionarParaAjuste(r.linhas, alvoM)
  if (alvo.length === 0) return { ok: true as const, ajustados: 0 }

  // Condições repetidas no UPDATE: um posto alterado por outra pessoa no meio do caminho não é sobrescrito.
  const { data, error } = await db
    .from('postos')
    .update({ raio_m: alvoM })
    .in('id', alvo.map(a => a.id))
    .eq('geo_confirmado', true)
    .gte('raio_m', RAIO_IMPORTADO_M)
    .select('id')
  if (error) return { ok: false as const, erro: 'Não foi possível ajustar agora. Nada foi alterado.' }

  const feitos = new Set(((data ?? []) as { id: string }[]).map(d => d.id))
  const eventos = alvo
    .filter(a => feitos.has(a.id))
    .map(a => ({
      posto_id: a.id,
      evento: 'raio_ajustado',
      raio_m: alvoM,
      executado_por: usuarioId,
      detalhe: `ajuste em massa: raio de ${a.raioAtual} m para ${alvoM} m`,
    }))
  if (eventos.length > 0) {
    try { await db.from('postos_geo_historico').insert(eventos) } catch { /* histórico é complementar */ }
  }
  return { ok: true as const, ajustados: feitos.size }
}
