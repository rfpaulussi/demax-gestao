// lib/absenteismo/calor.ts
import type { ClasseTaxa } from './classificar'
import { ORDEM_CLASSES, ROTULO_CLASSE } from './composicao'
import { diaSemana } from './datas'
import type { ResultadoCalculo } from './tipos'

export const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export interface LinhaCalor {
  classe: ClasseTaxa
  rotulo: string
  /** índice 0 = segunda ... 6 = domingo */
  porDia: number[]
  total: number
}

export function mapaCalor(r: ResultadoCalculo): LinhaCalor[] {
  const linhas: LinhaCalor[] = ORDEM_CLASSES.map(classe => ({
    classe, rotulo: ROTULO_CLASSE[classe], porDia: [0, 0, 0, 0, 0, 0, 0], total: 0,
  }))
  for (const ep of r.episodios) {
    if (ep.inicio_origem < r.inicio || ep.inicio_origem > r.fim) continue
    const idx = (diaSemana(ep.inicio_origem) + 6) % 7 // getUTCDay: domingo = 0 -> 6; segunda = 1 -> 0
    const linha = linhas.find(l => l.classe === ep.classe)
    if (!linha) continue
    linha.porDia[idx]++
    linha.total++
  }
  return linhas
}
