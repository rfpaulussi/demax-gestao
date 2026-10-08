// Datas como string YYYY-MM-DD; cálculo em UTC para não sofrer com fuso/DST.

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function parse(d: string): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day))
}

function fmt(dt: Date): string {
  return dt.toISOString().slice(0, 10)
}

export function hojeBR(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

export function addDias(d: string, n: number): string {
  const dt = parse(d)
  dt.setUTCDate(dt.getUTCDate() + n)
  return fmt(dt)
}

/** Segunda-feira da semana que contém `d`. */
export function segundaDe(d: string): string {
  const dow = parse(d).getUTCDay() // 0=dom
  return addDias(d, dow === 0 ? -6 : 1 - dow)
}

export function ehData(s: string | undefined | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s).getTime())
}

/** Seg–Sáb da semana. */
export function diasDaSemana(segunda: string): string[] {
  return Array.from({ length: 6 }, (_, i) => addDias(segunda, i))
}

export function diaMes(d: string): string {
  const dt = parse(d)
  return `${String(dt.getUTCDate()).padStart(2, '0')} ${MESES[dt.getUTCMonth()]}`
}

export function numeroDia(d: string): number {
  return parse(d).getUTCDate()
}

export function rotuloSemana(segunda: string): string {
  return `${diaMes(segunda)} – ${diaMes(addDias(segunda, 5))}`
}

export function diasEntre(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000)
}
