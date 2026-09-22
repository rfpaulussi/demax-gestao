export type NivelRisco = 'ok' | 'atencao' | 'critico'

export type FaltaEvento = { data_falta: string; tipo: string }
export type AdvertenciaEvento = { data_ocorrencia: string; grau: string | null }
export type AtestadoEvento = { data_inicio: string; data_fim: string | null }
export type MovimentacaoEvento = { created_at: string | null; tipo: string }

export type EventosScoreRisco = {
  faltas: FaltaEvento[]
  advertencias: AdvertenciaEvento[]
  atestados: AtestadoEvento[]
  movimentacoes: MovimentacaoEvento[]
}

export type ScoreRisco = {
  score: number
  nivel: NivelRisco
  breakdown: string[]
}

export const JANELA_SCORE_RISCO_DIAS = 90

const PESO_FALTA_SEM_JUSTIFICATIVA = 3
const PESO_FALTA_JUSTIFICADA = 0.5
const PESO_ATESTADO_POR_DIA = 0.3
const PESO_MOVIMENTACAO_EXTRA = 1
const LIMITE_MOVIMENTACOES_SEM_PONTO = 2

const PESO_GRAU_ADVERTENCIA: Record<string, number> = {
  verbal: 3,
  escrita: 5,
  suspensao: 8,
}
const PESO_GRAU_PADRAO = 3

const TIPOS_FALTA_JUSTIFICADA = new Set([
  'com_atestado', 'falta_justificada', 'declaracao',
])

const TIPOS_MOVIMENTACAO_RELEVANTES = new Set([
  'transferencia', 'mudanca_funcao', 'mudanca_horario',
])

const LIMIAR_ATENCAO = 5
const LIMIAR_CRITICO = 10

function diasEntre(inicio: string, fim: string | null): number {
  if (!fim) return 1
  const d1 = new Date(inicio)
  const d2 = new Date(fim)
  const diff = Math.round((d2.getTime() - d1.getTime()) / 86400000)
  return Math.max(1, diff + 1)
}

function arredondar(n: number): number {
  return Math.round(n * 10) / 10
}

export function dataCorteScoreRisco(referencia: Date = new Date()): string {
  const d = new Date(referencia)
  d.setUTCDate(d.getUTCDate() - JANELA_SCORE_RISCO_DIAS)
  return d.toISOString().split('T')[0]
}

export function calcularScoreRisco(eventos: EventosScoreRisco): ScoreRisco {
  let score = 0
  const breakdown: string[] = []

  const faltasSemJustificativa = eventos.faltas.filter(f => !TIPOS_FALTA_JUSTIFICADA.has(f.tipo))
  const faltasJustificadas = eventos.faltas.filter(f => TIPOS_FALTA_JUSTIFICADA.has(f.tipo))

  if (faltasSemJustificativa.length > 0) {
    const pts = arredondar(faltasSemJustificativa.length * PESO_FALTA_SEM_JUSTIFICATIVA)
    score += pts
    breakdown.push(`${faltasSemJustificativa.length} falta(s) sem justificativa (${pts}pt)`)
  }
  if (faltasJustificadas.length > 0) {
    const pts = arredondar(faltasJustificadas.length * PESO_FALTA_JUSTIFICADA)
    score += pts
    breakdown.push(`${faltasJustificadas.length} falta(s) justificada(s) (${pts}pt)`)
  }

  const advertenciasPorGrau = new Map<string, number>()
  for (const a of eventos.advertencias) {
    const grau = a.grau ?? 'verbal'
    advertenciasPorGrau.set(grau, (advertenciasPorGrau.get(grau) ?? 0) + 1)
  }
  for (const [grau, qtd] of advertenciasPorGrau) {
    const peso = PESO_GRAU_ADVERTENCIA[grau] ?? PESO_GRAU_PADRAO
    const pts = arredondar(qtd * peso)
    score += pts
    breakdown.push(`${qtd} advertência(s) grau ${grau} (${pts}pt)`)
  }

  const totalDiasAtestado = eventos.atestados.reduce((sum, a) => sum + diasEntre(a.data_inicio, a.data_fim), 0)
  if (totalDiasAtestado > 0) {
    const pts = arredondar(totalDiasAtestado * PESO_ATESTADO_POR_DIA)
    score += pts
    breakdown.push(`${totalDiasAtestado} dia(s) de atestado (${pts}pt)`)
  }

  const movRelevantes = eventos.movimentacoes.filter(m => TIPOS_MOVIMENTACAO_RELEVANTES.has(m.tipo))
  const extras = Math.max(0, movRelevantes.length - LIMITE_MOVIMENTACOES_SEM_PONTO)
  if (extras > 0) {
    const pts = arredondar(extras * PESO_MOVIMENTACAO_EXTRA)
    score += pts
    breakdown.push(`${movRelevantes.length} movimentação(ões) no período, ${extras} além do limite (${pts}pt)`)
  }

  score = arredondar(score)
  const nivel: NivelRisco = score >= LIMIAR_CRITICO ? 'critico' : score >= LIMIAR_ATENCAO ? 'atencao' : 'ok'

  return { score, nivel, breakdown }
}
