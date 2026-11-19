// lib/absenteismo/quadro.ts
import { addDias, diffDias, listarDias, maxData, minData } from './datas'

/** Campos mínimos para decidir se alguém está no quadro. `FuncionarioCalc` satisfaz este tipo. */
export interface FuncQuadro {
  id: string
  admissao: string | null
  desligamento: string | null
  /** true quando o status é desligado/rescisão indireta e não há data de desligamento. */
  fora_do_quadro: boolean
}

/** Intervalo [inicio, fim] em que o funcionário está no quadro dentro do período; null se nunca esteve. */
export function janelaDoFuncionario(
  f: FuncQuadro,
  inicio: string,
  fim: string,
): { inicio: string; fim: string } | null {
  if (f.fora_do_quadro) return null
  const ini = f.admissao ? maxData(f.admissao, inicio) : inicio
  const ultimo = f.desligamento ? minData(addDias(f.desligamento, -1), fim) : fim
  return ini <= ultimo ? { inicio: ini, fim: ultimo } : null
}

export function quadroNoDia(funcs: FuncQuadro[], dia: string): number {
  return funcs.filter(f => janelaDoFuncionario(f, dia, dia) !== null).length
}

/** Média diária do quadro no período: soma de dias-pessoa ÷ dias corridos do período. */
export function quadroMedio(funcs: FuncQuadro[], inicio: string, fim: string): number {
  const totalDias = listarDias(inicio, fim).length
  if (totalDias === 0) return 0
  let diasPessoa = 0
  for (const f of funcs) {
    const j = janelaDoFuncionario(f, inicio, fim)
    if (j) diasPessoa += diffDias(j.inicio, j.fim) + 1
  }
  return diasPessoa / totalDias
}
