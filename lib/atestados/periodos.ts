// lib/atestados/periodos.ts
//
// Regra de sobreposição de atestados (opção B):
//  - Dois atestados do mesmo funcionário NÃO podem cobrir os mesmos dias.
//  - Exceção: passagem de bastão em UM dia — o anterior termina no dia em que o seguinte começa
//    (ex.: 02→04/09 e 04→13/09). O documento fica como foi emitido; nas contagens o dia
//    compartilhado vale uma vez só (ver `diasUnicosAtestados`).
//  - Um atestado dentro do outro, ou dois iguais (inclusive de 1 dia), continuam barrados.
//
// O mesmo critério está no trigger `atestados_sem_sobreposicao` (migration 20260930).

export type PeriodoAtestado = { data_inicio: string; data_fim: string | null }

const fimDe = (p: PeriodoAtestado) => p.data_fim ?? p.data_inicio

export function atestadosConflitam(a: PeriodoAtestado, b: PeriodoAtestado): boolean {
  const aFim = fimDe(a)
  const bFim = fimDe(b)
  if (!(a.data_inicio <= bFim && b.data_inicio <= aFim)) return false
  const aEntregaParaB = aFim === b.data_inicio && a.data_inicio < b.data_inicio && aFim < bFim
  const bEntregaParaA = bFim === a.data_inicio && b.data_inicio < a.data_inicio && bFim < aFim
  return !(aEntregaParaB || bEntregaParaA)
}

const MS_DIA = 86400000
const utc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) }

/** Dias corridos cobertos por um conjunto de atestados, contando cada dia uma única vez. */
export function diasUnicosAtestados(atestados: PeriodoAtestado[]): number {
  const ordenados = atestados
    .map(a => ({ ini: utc(a.data_inicio), fim: utc(fimDe(a)) }))
    .sort((x, y) => x.ini - y.ini)
  let total = 0
  let ate = -Infinity
  for (const { ini, fim } of ordenados) {
    const de = Math.max(ini, ate + MS_DIA)
    if (fim >= de) total += Math.round((fim - de) / MS_DIA) + 1
    ate = Math.max(ate, fim)
  }
  return total
}
