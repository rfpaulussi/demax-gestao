// lib/absenteismo/filtros.ts
import type { FuncionarioCalc } from './tipos'

export interface FiltrosAbsenteismo {
  secretaria?: string | null
  posto_id?: string | null
  supervisor_id?: string | null
}

/** Secretaria, posto e supervisor são os ATUAIS do funcionário (não há histórico de posto por dia). */
export function filtrarFuncionarios(funcs: FuncionarioCalc[], filtros: FiltrosAbsenteismo): FuncionarioCalc[] {
  return funcs.filter(f =>
    (!filtros.secretaria || f.secretaria === filtros.secretaria) &&
    (!filtros.posto_id || f.posto_id === filtros.posto_id) &&
    (!filtros.supervisor_id || f.supervisor_id === filtros.supervisor_id),
  )
}
