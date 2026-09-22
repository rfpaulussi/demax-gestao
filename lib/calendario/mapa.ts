import type { TipoFeriado } from './feriados-mogi'

export interface CalendarioLinha {
  data: string
  nome: string
  tipo: TipoFeriado
  ate_hora: string | null
}

export function calendarioParaMapa(linhas: CalendarioLinha[]): Map<string, { nome: string; tipo: string }> {
  return new Map(linhas.map(l => [l.data, { nome: l.nome, tipo: l.tipo }]))
}
