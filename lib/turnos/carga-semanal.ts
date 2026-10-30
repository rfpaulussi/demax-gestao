// lib/turnos/carga-semanal.ts
import { montarSemana, totalSemanalMin, type TurnoRow } from '@/lib/acordos/horario-do-turno'

/** Carga semanal esperada dos regimes 5x2 e 5x1 (44h). */
export const CARGA_SEMANAL_ALVO_MIN = 44 * 60

export interface AvisoCargaSemanal {
  /** Carga semanal calculada do turno, em minutos. */
  min: number
  /** Diferença para as 44h (positiva = acima, negativa = abaixo). */
  difMin: number
}

/** Formata minutos como "40h" ou "43h30". */
export function formatarCargaSemanal(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

/**
 * Aviso quando um turno 5x2/5x1 não fecha 44h na semana; null quando fecha ou quando o regime
 * não segue essa regra (12x36 é rodízio por data e jovem aprendiz tem jornada própria).
 */
export function avisoCargaSemanal(t: TurnoRow): AvisoCargaSemanal | null {
  if (t.tipo_escala !== '5x2' && t.tipo_escala !== '5x1') return null
  const min = totalSemanalMin(montarSemana(t))
  if (min === CARGA_SEMANAL_ALVO_MIN) return null
  return { min, difMin: min - CARGA_SEMANAL_ALVO_MIN }
}
