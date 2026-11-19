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
    if (valor === '—') return
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

/** Abaixo disso a taxa de um grupo oscila com 1 ou 2 casos; a tela avisa em vez de pintar de alerta. */
export const MIN_JORNADAS_CONFIAVEL = 15

export interface LinhaRankingTela extends LinhaRanking {
  poucos_casos: boolean
}

export interface RankingParaTela {
  /** Grupos com pelo menos 1 jornada perdida, na ordem recebida. */
  linhas: LinhaRankingTela[]
  /** Grupos sem nenhuma jornada perdida (menos AFASTADOS), em ordem alfabética. */
  sem_ocorrencias: string[]
  /** AFASTADOS não é secretaria: quem está afastado sai da base da taxa, então o 0,00% enganaria. */
  afastados_quadro: number | null
}

/** Separa o que merece linha no ranking do que vira nota de rodapé. Não altera nenhum cálculo. */
export function prepararRanking(linhas: LinhaRanking[]): RankingParaTela {
  let afastados_quadro: number | null = null
  const sem_ocorrencias: string[] = []
  const principais: LinhaRankingTela[] = []
  for (const l of linhas) {
    if (l.jornadas_perdidas > 0) {
      principais.push({ ...l, poucos_casos: l.jornadas_perdidas < MIN_JORNADAS_CONFIAVEL })
    } else if (l.valor === 'AFASTADOS') {
      afastados_quadro = l.quadro_medio
    } else {
      sem_ocorrencias.push(l.valor)
    }
  }
  sem_ocorrencias.sort((a, b) => a.localeCompare(b))
  return { linhas: principais, sem_ocorrencias, afastados_quadro }
}
