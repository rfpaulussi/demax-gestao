// lib/absenteismo/ranking.ts
import { calcularPeriodo } from './calculo'
import { calcularKpis } from './kpis'
import type { EntradaCalculo, FuncionarioCalc } from './tipos'

export type ChaveRanking = 'secretaria' | 'posto_nome' | 'supervisor'

export interface LinhaRanking {
  valor: string
  quadro_medio: number
  jornadas_perdidas: number
  episodios: number
  taxa: number
}

/** Calcula o período separadamente para cada grupo de funcionários e ordena pela taxa (maior primeiro). */
export function rankingPor(chave: ChaveRanking, entrada: EntradaCalculo): LinhaRanking[] {
  const grupos = new Map<string, FuncionarioCalc[]>()
  for (const f of entrada.funcionarios) {
    const valor = f[chave]
    const lista = grupos.get(valor)
    if (lista) lista.push(f)
    else grupos.set(valor, [f])
  }

  const linhas: LinhaRanking[] = []
  Array.from(grupos.entries()).forEach(([valor, funcionarios]) => {
    const k = calcularKpis(calcularPeriodo({ ...entrada, funcionarios }))
    if (k.quadro_medio <= 0) return
    linhas.push({
      valor,
      quadro_medio: k.quadro_medio,
      jornadas_perdidas: k.jornadas_perdidas,
      episodios: k.episodios,
      taxa: k.taxa,
    })
  })

  return linhas.sort((a, b) => b.taxa - a.taxa || b.jornadas_perdidas - a.jornadas_perdidas || a.valor.localeCompare(b.valor))
}
