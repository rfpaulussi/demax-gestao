import { DIAS_SEMANA, type DiaSemana, type DiaTurno, type SemanaTurno } from './tipos'
import { hhmmParaMin } from './tempo'

/** Colunas de `turnos_postos` usadas aqui (horas podem vir como 'HH:MM:SS'). */
export interface TurnoRow {
  tipo_escala: string
  hora_entrada: string
  hora_saida_seg_qui: string
  hora_saida_sex: string | null
  hora_inicio_almoco: string | null
  hora_fim_almoco: string | null
  hora_entrada_sex?: string | null
  hora_entrada_sabado?: string | null
  hora_inicio_almoco_sabado?: string | null
  hora_fim_almoco_sabado?: string | null
  hora_saida_sabado?: string | null
}

/** Usado quando o funcionário não tem turno vigente cadastrado: 5x2, 07:00–17:00, almoço 12:00–13:12 (44h). */
export const TURNO_PADRAO: TurnoRow = {
  tipo_escala: '5x2',
  hora_entrada: '07:00',
  hora_saida_seg_qui: '17:00',
  hora_saida_sex: '17:00',
  hora_inicio_almoco: '12:00',
  hora_fim_almoco: '13:12',
}

const hh = (v: string | null | undefined) => (v ? v.slice(0, 5) : '')
const FOLGA: DiaTurno = { folga: true, e1: '', s1: '', e2: '', s2: '' }

function dia(entrada: string, inicioAlmoco: string, fimAlmoco: string, saida: string): DiaTurno {
  if (inicioAlmoco && fimAlmoco) return { folga: false, e1: entrada, s1: inicioAlmoco, e2: fimAlmoco, s2: saida }
  return { folga: false, e1: entrada, s1: saida, e2: '', s2: '' }
}

export function montarSemana(t: TurnoRow): SemanaTurno {
  const almI = hh(t.hora_inicio_almoco)
  const almF = hh(t.hora_fim_almoco)
  const segQui = dia(hh(t.hora_entrada), almI, almF, hh(t.hora_saida_seg_qui))
  const sex = dia(
    hh(t.hora_entrada_sex) || hh(t.hora_entrada),
    almI, almF,
    hh(t.hora_saida_sex) || hh(t.hora_saida_seg_qui),
  )
  const sabadoDistinto = !!t.hora_entrada_sabado && !!t.hora_saida_sabado
  let sab: DiaTurno
  if (sabadoDistinto) {
    sab = dia(hh(t.hora_entrada_sabado), hh(t.hora_inicio_almoco_sabado), hh(t.hora_fim_almoco_sabado), hh(t.hora_saida_sabado))
  } else if (t.tipo_escala === '5x1') {
    sab = { ...segQui }
  } else {
    sab = { ...FOLGA }
  }
  return {
    'Segunda-feira': { ...segQui },
    'Terça-feira': { ...segQui },
    'Quarta-feira': { ...segQui },
    'Quinta-feira': { ...segQui },
    'Sexta-feira': sex,
    'Sábado': sab,
    'Domingo': { ...FOLGA },
  }
}

export function jornadaDiaMin(d: DiaTurno): number {
  if (d.folga) return 0
  const p1 = d.e1 && d.s1 ? hhmmParaMin(d.s1) - hhmmParaMin(d.e1) : 0
  const p2 = d.e2 && d.s2 ? hhmmParaMin(d.s2) - hhmmParaMin(d.e2) : 0
  return Math.max(0, p1) + Math.max(0, p2)
}

export function totalSemanalMin(s: SemanaTurno): number {
  return DIAS_SEMANA.reduce((acc, d) => acc + jornadaDiaMin(s[d]), 0)
}

/** Texto por dia, no formato já usado em `TurnoHorario.horario` e no PDF. */
export function semanaParaTexto(s: SemanaTurno): Record<DiaSemana, string> {
  const out = {} as Record<DiaSemana, string>
  for (const d of DIAS_SEMANA) {
    const t = s[d]
    if (t.folga) { out[d] = 'FOLGA'; continue }
    const p1 = t.e1 && t.s1 ? `${t.e1} às ${t.s1}` : ''
    const p2 = t.e2 && t.s2 ? `${t.e2} às ${t.s2}` : ''
    out[d] = [p1, p2].filter(Boolean).join(' / ')
  }
  return out
}

/** Chave para agrupar funcionários com semana idêntica (mesmo turno). */
export function assinaturaSemana(s: SemanaTurno): string {
  return JSON.stringify(DIAS_SEMANA.map(d => s[d]))
}

/** Períodos trabalhados do dia em minutos [início, fim]; vazio na folga. */
function periodosMin(d: DiaTurno): [number, number][] {
  if (d.folga) return []
  const out: [number, number][] = []
  if (d.e1 && d.s1) out.push([hhmmParaMin(d.e1), hhmmParaMin(d.s1)])
  if (d.e2 && d.s2) out.push([hhmmParaMin(d.e2), hhmmParaMin(d.s2)])
  return out
}

/** Horário de saída normal do dia ('' se folga). */
export function saidaDoDia(d: DiaTurno): string {
  if (d.folga) return ''
  return d.s2 || d.s1
}

/** Minutos trabalhados (sem almoço) de `hhmm` até o fim do dia; folga = 0. */
export function minutosAposHorario(d: DiaTurno, hhmm: string): number {
  const h = hhmmParaMin(hhmm)
  return periodosMin(d).reduce((acc, [ini, fim]) => acc + Math.max(0, fim - Math.max(ini, h)), 0)
}

/** Minutos do intervalo [inicio, fim] que ficam fora dos períodos trabalhados do dia; nunca negativo. */
export function minutosForaDoHorario(d: DiaTurno, inicio: string, fim: string): number {
  const i = hhmmParaMin(inicio)
  const f = hhmmParaMin(fim)
  const total = f - i
  if (total <= 0) return 0
  const dentro = periodosMin(d).reduce(
    (acc, [ini, fimP]) => acc + Math.max(0, Math.min(fimP, f) - Math.max(ini, i)),
    0,
  )
  return Math.max(0, total - dentro)
}

/** ['Turno A'] -> 'Turno A'; dois -> 'Turno A e Turno C'; três ou mais -> 'Turno A, Turno B e Turno C'. */
export function juntarRotulos(rotulos: string[]): string {
  if (rotulos.length <= 1) return rotulos.join('')
  return `${rotulos.slice(0, -1).join(', ')} e ${rotulos[rotulos.length - 1]}`
}

/**
 * `horario_semana` v2: remove `objeto` de todos os turnos (usado quando o texto do acordo é editado à mão,
 * para o PDF voltar ao parágrafo único). v1, nulo ou sem `objeto`: devolve o mesmo valor.
 */
export function removerObjetosDosTurnos(raw: unknown): unknown {
  const r = raw as { _v?: number; turnos?: unknown } | null | undefined
  if (!r || r._v !== 2 || !Array.isArray(r.turnos)) return raw
  if (!r.turnos.some(t => t && typeof t === 'object' && 'objeto' in t)) return raw
  return {
    ...r,
    turnos: r.turnos.map(t => {
      if (!t || typeof t !== 'object') return t
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { objeto, ...resto } = t as Record<string, unknown>
      return resto
    }),
  }
}
