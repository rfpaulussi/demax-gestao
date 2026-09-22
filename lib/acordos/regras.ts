/** Limites revisáveis pelo RH/jurídico. Convenção coletiva pode alterá-los. */
export const MAX_ACRESCIMO_DIA_MIN = 2 * 60
export const MAX_JORNADA_DIA_MIN = 10 * 60
export const JORNADA_SEMANAL_MIN = 44 * 60
export const PRAZO_MAXIMO_MESES = 6
export const REGIMES_ELEGIVEIS = ['5x2', '5x1'] as const

export function regimeElegivel(regime: string): boolean {
  return (REGIMES_ELEGIVEIS as readonly string[]).includes(regime)
}
