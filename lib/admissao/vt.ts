import type { LinhaVT } from './tipos'

/** "4,50" ou "1.234,56" → número; vazio ou inválido → null. */
export function numeroBR(texto: string | null | undefined): number | null {
  const limpo = (texto ?? '').trim().replace(/[R$\s]/g, '')
  if (!limpo) return null
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  const n = Number(normalizado)
  return Number.isFinite(n) ? n : null
}

export function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return ''
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Linha em branco (sem linha de transporte nem valor) não entra na conta. */
export function linhaVtPreenchida(l: LinhaVT): boolean {
  return !!(l.linha.trim() || l.empresa.trim() || numeroBR(l.valor) !== null)
}

/** Soma do dia: valor gasto por dia (passagem × quantidade) e total de passagens por dia. */
export function totaisVT(linhas: LinhaVT[]): { valorDia: number; passagensDia: number } {
  let valorDia = 0
  let passagensDia = 0
  for (const l of linhas.filter(linhaVtPreenchida)) {
    const qtd = numeroBR(l.qtd) ?? 0
    valorDia += (numeroBR(l.valor) ?? 0) * qtd
    passagensDia += qtd
  }
  return { valorDia: Math.round(valorDia * 100) / 100, passagensDia }
}
