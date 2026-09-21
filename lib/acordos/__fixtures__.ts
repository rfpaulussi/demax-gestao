import type { FuncionarioCalc } from './tipos'
import { montarSemana, type TurnoRow } from './horario-do-turno'

/** 5x2, 07:00–17:00, almoço 12:00–13:12 → 528 min por dia útil (44h). */
export const T_5X2_528: TurnoRow = {
  tipo_escala: '5x2', hora_entrada: '07:00', hora_saida_seg_qui: '17:00', hora_saida_sex: null,
  hora_inicio_almoco: '12:00', hora_fim_almoco: '13:12',
}

/** 5x2, seg–qui 540 min, sexta 480 min (44h). */
export const T_5X2_540: TurnoRow = {
  tipo_escala: '5x2', hora_entrada: '07:00', hora_saida_seg_qui: '17:00', hora_saida_sex: '16:00',
  hora_inicio_almoco: '12:00', hora_fim_almoco: '13:00',
}

export function func(id: string, turno: TurnoRow = T_5X2_528, extra: Partial<FuncionarioCalc> = {}): FuncionarioCalc {
  return {
    id, nome: `Func ${id}`, status: 'ativo', regime: turno.tipo_escala,
    semana: montarSemana(turno), semTurno: false, ...extra,
  }
}
