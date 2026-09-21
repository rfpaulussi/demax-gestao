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
