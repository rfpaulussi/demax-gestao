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

/** Mês no formato YYYY-MM. */
export function mesValido(m: string | undefined | null): m is string {
  return !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m)
}

/** Soma `n` meses a um YYYY-MM. */
export function addMeses(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1 + n, 1))
  return dt.toISOString().slice(0, 7)
}

const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function rotuloMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return `${MESES_LONGOS[m - 1]} de ${a}`
}

/** Dias úteis da semana (seg–sex). Supervisores não trabalham aos sábados. */
export function diasDaSemana(segunda: string): string[] {
  return Array.from({ length: 5 }, (_, i) => addDias(segunda, i))
}

/** true para segunda a sexta. */
export function ehDiaUtil(data: string): boolean {
  const dow = parse(data).getUTCDay()
  return dow >= 1 && dow <= 5
}

export function diaMes(d: string): string {
  const dt = parse(d)
  return `${String(dt.getUTCDate()).padStart(2, '0')} ${MESES[dt.getUTCMonth()]}`
}

export function numeroDia(d: string): number {
  return parse(d).getUTCDate()
}

export function rotuloSemana(segunda: string): string {
  return `${diaMes(segunda)} – ${diaMes(addDias(segunda, 4))}`
}

export function diasEntre(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000)
}
