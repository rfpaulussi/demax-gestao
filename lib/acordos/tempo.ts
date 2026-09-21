import { DIAS_SEMANA, type DiaSemana } from './tipos'

const p2 = (n: number) => String(n).padStart(2, '0')

export function hhmmParaMin(hhmm: string): number {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

export function minParaHHMM(min: number): string {
  return `${p2(Math.floor(min / 60))}:${p2(min % 60)}`
}

export function fmtDataBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** 60 -> '01:00h' */
export function fmtAcrescimo(min: number): string {
  return `${minParaHHMM(min)}h`
}

/** '15:00' -> '15h'; '15:30' -> '15h30' */
export function fmtHoraCurta(hhmm: string): string {
  const [h, m] = hhmm.slice(0, 5).split(':')
  return m === '00' ? `${h}h` : `${h}h${m}`
}

/** 120 -> '02 hora(s)'; 150 -> '02h30min' */
export function fmtHorasTotal(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${p2(h)} hora(s)` : `${p2(h)}h${p2(m)}min`
}

/** ['2026-06-30'] -> 'no dia 30/06/2026'; várias -> 'nos dias A, B e C' (ordenadas). */
export function fmtDatasComPrefixo(isos: string[]): string {
  const ord = [...isos].sort().map(fmtDataBR)
  if (ord.length === 1) return `no dia ${ord[0]}`
  return `nos dias ${ord.slice(0, -1).join(', ')} e ${ord[ord.length - 1]}`
}

export function diaSemanaDe(iso: string): DiaSemana {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = domingo
  return DIAS_SEMANA[(dow + 6) % 7]
}

export function addDias(iso: string, n: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** 'YYYY-MM' */
export function mesDe(iso: string): string {
  return iso.slice(0, 7)
}

/** Soma meses ajustando o dia ao último dia do mês de destino. */
export function addMeses(iso: string, n: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const total = (m - 1) + n
  const ny = y + Math.floor(total / 12)
  const nm = ((total % 12) + 12) % 12
  const ultimo = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  return `${ny}-${p2(nm + 1)}-${p2(Math.min(d, ultimo))}`
}
