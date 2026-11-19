// lib/absenteismo/kpis.ts
import type { ResultadoCalculo } from './tipos'

export interface Kpis {
  /** jornadas perdidas ÷ jornadas programadas × 100 */
  taxa: number
  jornadas_perdidas: number
  episodios: number
  funcionarios_afetados: number
  quadro_medio: number
  /** episódios ÷ quadro médio × 100 (IF) */
  indice_frequencia: number
  /** jornadas perdidas ÷ quadro médio × 100 (IG) */
  indice_gravidade: number
  /** jornadas perdidas ÷ episódios */
  duracao_media: number
  /** afetados ÷ quadro médio × 100 */
  pct_afetados: number
  /** afetados com 2+ episódios ÷ afetados × 100 */
  taxa_reincidencia: number
}

const razao = (num: number, den: number): number => (den > 0 ? num / den : 0)

export function calcularKpis(r: ResultadoCalculo): Kpis {
  const episodios = r.episodios.length
  return {
    taxa: razao(r.jornadas_perdidas, r.jornadas_programadas) * 100,
    jornadas_perdidas: r.jornadas_perdidas,
    episodios,
    funcionarios_afetados: r.funcionarios_afetados,
    quadro_medio: r.quadro_medio,
    indice_frequencia: razao(episodios, r.quadro_medio) * 100,
    indice_gravidade: razao(r.jornadas_perdidas, r.quadro_medio) * 100,
    duracao_media: razao(r.jornadas_perdidas, episodios),
    pct_afetados: razao(r.funcionarios_afetados, r.quadro_medio) * 100,
    taxa_reincidencia: razao(r.funcionarios_reincidentes, r.funcionarios_afetados) * 100,
  }
}

/** Variação relativa em %, para contagens. null quando não há base (anterior = 0). */
export function variacaoPercentual(atual: number, anterior: number): number | null {
  return anterior === 0 ? null : ((atual - anterior) / anterior) * 100
}

/** Diferença em pontos percentuais, para taxas. */
export function variacaoPontos(atual: number, anterior: number): number {
  return atual - anterior
}
