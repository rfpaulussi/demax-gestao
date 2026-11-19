// lib/absenteismo/datas.ts
// Datas ISO (yyyy-mm-dd) tratadas sempre em UTC: sem fuso, sem horário de verão, determinístico em teste.

const MS_DIA = 86400000
const pad = (n: number) => String(n).padStart(2, '0')

export function utc(isoDate: string): number {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function paraIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDias(isoDate: string, n: number): string {
  return paraIso(utc(isoDate) + n * MS_DIA)
}

/** `ate - de`, em dias corridos. */
export function diffDias(de: string, ate: string): number {
  return Math.round((utc(ate) - utc(de)) / MS_DIA)
}

/** Todos os dias de `inicio` a `fim`, inclusive. Vazio se `inicio > fim`. */
export function listarDias(inicio: string, fim: string): string[] {
  const out: string[] = []
  for (let t = utc(inicio); t <= utc(fim); t += MS_DIA) out.push(paraIso(t))
  return out
}

/** 0 = domingo ... 6 = sábado. */
export function diaSemana(isoDate: string): number {
  return new Date(utc(isoDate)).getUTCDay()
}

export function maxData(a: string, b: string): string {
  return a > b ? a : b
}

export function minData(a: string, b: string): string {
  return a < b ? a : b
}

export function periodoDoMes(ano: number, mes: number): { inicio: string; fim: string } {
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  return { inicio: `${ano}-${pad(mes)}-01`, fim: `${ano}-${pad(mes)}-${pad(ultimo)}` }
}

export function mesAnterior(ano: number, mes: number): { ano: number; mes: number } {
  return mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 }
}
