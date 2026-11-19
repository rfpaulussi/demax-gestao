// lib/absenteismo/hoje.ts

/** Data de hoje (yyyy-mm-dd) no fuso de Brasília. O formato `en-CA` já sai como ano-mês-dia. */
export function hojeBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora)
}
