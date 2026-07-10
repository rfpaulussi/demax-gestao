// Algoritmo de Butcher: calcula a data da Páscoa para qualquer ano
function calcEaster(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day   = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day, 12)
}

export function feriadosDoAno(year: number): Set<string> {
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const addDias = (base: Date, n: number) =>
    new Date(base.getTime() + n * 86400000)

  const pascoa = calcEaster(year)

  const fixos = [
    `${year}-01-01`, // Confraternização Universal
    `${year}-04-21`, // Tiradentes
    `${year}-05-01`, // Dia do Trabalho
    `${year}-07-09`, // Revolução Constitucionalista (SP)
    `${year}-09-07`, // Independência
    `${year}-10-12`, // Nossa Senhora Aparecida
    `${year}-11-02`, // Finados
    `${year}-11-15`, // Proclamação da República
    `${year}-11-20`, // Consciência Negra (nacional desde 2023)
    `${year}-12-25`, // Natal
    // Mogi das Cruzes
    `${year}-01-25`, // Aniversário de São Paulo (ponto facultativo SP)
    `${year}-06-26`, // Aniversário de Mogi das Cruzes
    `${year}-07-26`, // Dia de Sant'Ana (Padroeira do município)
    `${year}-09-01`, // Aniversário da Fundação de Mogi das Cruzes
  ]

  const moveis = [
    fmt(addDias(pascoa, -48)), // Segunda de Carnaval
    fmt(addDias(pascoa, -47)), // Terça de Carnaval
    fmt(addDias(pascoa, -2)),  // Sexta-feira Santa
    fmt(addDias(pascoa, 60)),  // Corpus Christi
  ]

  return new Set([...fixos, ...moveis])
}

export function diasUteisNoPeriodo(
  start: Date,
  end: Date,
  regime: string,
  feriados: Set<string>
): number {
  if (start > end) return 0
  let count = 0
  const d = new Date(start)
  while (d <= end) {
    const dateStr = d.toISOString().split('T')[0]
    const dow = d.getDay()
    if (regime === '5x1' || regime === '12x36') {
      // dias corridos, mas pula feriados
      if (!feriados.has(dateStr)) count++
    } else {
      // 5x2: seg-sex, pula feriados
      if (dow !== 0 && dow !== 6 && !feriados.has(dateStr)) count++
    }
    d.setDate(d.getDate() + 1)
  }
  return count
}

export function toDate(s: string): Date {
  return new Date(s + 'T12:00:00')
}
