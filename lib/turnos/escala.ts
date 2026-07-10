// lib/turnos/escala.ts

export const TIPOS_ESCALA = ['5x2', '5x1', '12x36'] as const
export type TipoEscala = (typeof TIPOS_ESCALA)[number]

export function isTipoEscala(value: string | null | undefined): value is TipoEscala {
  return !!value && (TIPOS_ESCALA as readonly string[]).includes(value)
}

/** Normaliza um valor de regime vindo do banco (sem CHECK constraint) para um TipoEscala válido, caindo em '5x2' se ausente ou inválido. */
export function resolverTipoEscala(value: string | null | undefined): TipoEscala {
  return isTipoEscala(value) ? value : '5x2'
}

export const ESCALA_LABEL: Record<TipoEscala, string> = {
  '5x2': '5×2 · 44h/sem',
  '5x1': '5×1 · 44h/sem',
  '12x36': '12×36',
}

export const ESCALA_BADGE_CLASS: Record<TipoEscala, string> = {
  '5x2': 'bg-blue-50 text-blue-700 ring-blue-200',
  '5x1': 'bg-purple-50 text-purple-700 ring-purple-200',
  '12x36': 'bg-orange-50 text-orange-700 ring-orange-200',
}

export const ESCALA_BORDER_CLASS: Record<TipoEscala, string> = {
  '5x2': 'border-blue-500',
  '5x1': 'border-purple-500',
  '12x36': 'border-orange-500',
}

export interface HorariosDerivados {
  hora_inicio_almoco: string | null
  hora_fim_almoco: string | null
  hora_saida_seg_qui: string
  hora_saida_sex: string | null
}

export interface TurnoHorarios {
  hora_entrada: string
  hora_saida_seg_qui: string
  hora_saida_sex: string | null
  hora_inicio_almoco: string | null
  hora_fim_almoco: string | null
}

function minutosParaHora(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

// 5x2 — base 07:00, almoço 12:00–13:12 (72min), saída 17:00 (seg-qui) / 16:00 (sex). 44h/semana.
const BASE_5X2_ENTRADA_MIN = 7 * 60
const BASE_5X2_ALMOCO_INICIO_MIN = 12 * 60
const BASE_5X2_ALMOCO_FIM_MIN = 13 * 60 + 12
const BASE_5X2_SAIDA_SEGQUI_MIN = 17 * 60
const BASE_5X2_SAIDA_SEX_MIN = 16 * 60

// 5x1 — 7h20 de trabalho/dia (44h ÷ 6 dias) + 1h de almoço, com o almoço começando 4h após a entrada.
const CARGA_DIARIA_5X1_MIN = 7 * 60 + 20
const ALMOCO_DURACAO_5X1_MIN = 60
const ALMOCO_OFFSET_5X1_MIN = 4 * 60

// 12x36 — 12h de trabalho + 1h de intervalo descontado da duração total (sem horário de almoço fixo).
const DURACAO_12X36_MIN = 13 * 60

/** Calcula almoço/saída a partir da hora de entrada, seguindo a regra do regime informado. */
export function calcularHorariosDerivados(horaEntrada: string, tipoEscala: TipoEscala): HorariosDerivados {
  const entradaMin = horaParaMinutos(horaEntrada)

  if (tipoEscala === '5x1') {
    const almocoInicio = entradaMin + ALMOCO_OFFSET_5X1_MIN
    const almocoFim = almocoInicio + ALMOCO_DURACAO_5X1_MIN
    const saida = entradaMin + CARGA_DIARIA_5X1_MIN + ALMOCO_DURACAO_5X1_MIN
    return {
      hora_inicio_almoco: minutosParaHora(almocoInicio),
      hora_fim_almoco: minutosParaHora(almocoFim),
      hora_saida_seg_qui: minutosParaHora(saida),
      hora_saida_sex: null,
    }
  }

  if (tipoEscala === '12x36') {
    return {
      hora_inicio_almoco: null,
      hora_fim_almoco: null,
      hora_saida_seg_qui: minutosParaHora(entradaMin + DURACAO_12X36_MIN),
      hora_saida_sex: null,
    }
  }

  // 5x2 (default)
  const delta = entradaMin - BASE_5X2_ENTRADA_MIN
  return {
    hora_inicio_almoco: minutosParaHora(BASE_5X2_ALMOCO_INICIO_MIN + delta),
    hora_fim_almoco: minutosParaHora(BASE_5X2_ALMOCO_FIM_MIN + delta),
    hora_saida_seg_qui: minutosParaHora(BASE_5X2_SAIDA_SEGQUI_MIN + delta),
    hora_saida_sex: minutosParaHora(BASE_5X2_SAIDA_SEX_MIN + delta),
  }
}

/** Formata "HH:MM:SS" (ou já "HH:MM") vindo do banco; retorna "—" para null/undefined. */
export function fmtHora(h: string | null | undefined): string {
  return h ? h.slice(0, 5) : '—'
}

/** Duração do almoço em minutos, ou null se o turno não tiver horário de almoço fixo. */
export function duracaoAlmocoMin(inicio: string | null, fim: string | null): number | null {
  if (!inicio || !fim) return null
  return horaParaMinutos(fim.slice(0, 5)) - horaParaMinutos(inicio.slice(0, 5))
}

/** Resumo textual de um turno, adaptado ao regime (detectado pela presença dos campos). */
export function formatarResumoTurno(t: TurnoHorarios): string {
  const entrada = fmtHora(t.hora_entrada)
  const saida = fmtHora(t.hora_saida_seg_qui)

  if (t.hora_saida_sex !== null) {
    return `Seg–Qui ${entrada}–${saida} (almoço ${fmtHora(t.hora_inicio_almoco)}–${fmtHora(t.hora_fim_almoco)}) · Sex até ${fmtHora(t.hora_saida_sex)}`
  }
  if (t.hora_inicio_almoco !== null && t.hora_fim_almoco !== null) {
    return `Todos os dias ${entrada}–${saida} (almoço ${fmtHora(t.hora_inicio_almoco)}–${fmtHora(t.hora_fim_almoco)})`
  }
  return `${entrada}–${saida} (12h + intervalo)`
}
