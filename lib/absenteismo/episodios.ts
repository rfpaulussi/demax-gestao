// lib/absenteismo/episodios.ts
import { addDias } from './datas'

export interface PeriodoComId {
  id: string
  data_inicio: string
  data_fim: string
}

/**
 * Agrupa atestados de UM funcionário em episódios: o seguinte entra no grupo quando começa
 * até o dia seguinte ao fim mais tardio do grupo (cobre emendados, passagem de bastão e aninhados).
 * O primeiro elemento de cada grupo (por início) identifica o episódio.
 */
export function agruparAtestadosContiguos<T extends PeriodoComId>(atestados: T[]): T[][] {
  const ordenados = [...atestados].sort(
    (a, b) => a.data_inicio.localeCompare(b.data_inicio) || a.data_fim.localeCompare(b.data_fim),
  )
  const grupos: T[][] = []
  let fimDoGrupo = ''
  for (const a of ordenados) {
    if (grupos.length > 0 && a.data_inicio <= addDias(fimDoGrupo, 1)) {
      grupos[grupos.length - 1].push(a)
      if (a.data_fim > fimDoGrupo) fimDoGrupo = a.data_fim
    } else {
      grupos.push([a])
      fimDoGrupo = a.data_fim
    }
  }
  return grupos
}
