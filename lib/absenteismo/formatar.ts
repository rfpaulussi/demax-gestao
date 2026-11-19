// lib/absenteismo/formatar.ts
import { MESES_ABREV } from './constantes'

const nf = (casas: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

export function fmtPct(v: number, casas = 2): string {
  return `${nf(casas).format(v)}%`
}

export function fmtInt(v: number): string {
  return nf(0).format(Math.round(v))
}

export function fmtDec(v: number, casas = 1): string {
  return nf(casas).format(v)
}

const sinal = (v: number): string => (v > 0 ? '+' : v < 0 ? '−' : '')

/** Variação relativa ("+12,3%"). null = sem base. */
export function fmtVariacaoPct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—'
  const arredondado = Math.round(v * 10) / 10
  return `${sinal(arredondado)}${fmtDec(Math.abs(arredondado), 1)}%`
}

/** Diferença em pontos percentuais ("−0,40 p.p."). null = sem base. */
export function fmtVariacaoPp(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—'
  const arredondado = Math.round(v * 100) / 100
  return `${sinal(arredondado)}${fmtDec(Math.abs(arredondado), 2)} p.p.`
}

/** 'yyyy-mm' -> 'nov/26' */
export function rotuloMes(mes: string): string {
  const [ano, m] = mes.split('-')
  return `${MESES_ABREV[Number(m)]}/${ano.slice(2)}`
}

export function fmtDataBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function fmtPeriodo(inicio: string, fim: string): string {
  return `${fmtDataBR(inicio)} a ${fmtDataBR(fim)}`
}
