// lib/absenteismo/jornadas.ts
import { feriadosDoAno } from '@/lib/utils/dias-uteis'
import { diaSemana, listarDias } from './datas'

/** Feriados (nacionais + Mogi das Cruzes) de todos os anos que o período toca. */
export function feriadosDoPeriodo(inicio: string, fim: string): Set<string> {
  const out = new Set<string>()
  const de = Number(inicio.slice(0, 4))
  const ate = Number(fim.slice(0, 4))
  for (let ano = de; ano <= ate; ano++) {
    Array.from(feriadosDoAno(ano)).forEach(d => out.add(d))
  }
  return out
}

/**
 * Dias em que o funcionário deveria trabalhar entre `inicio` e `fim`, pela escala.
 * Mesma regra de `diasUteisNoPeriodo` (lib/utils/dias-uteis.ts), mas devolve as datas,
 * não só a contagem, para permitir interseção com os dias de ausência.
 *  - 5x1: ciclo de 6 dias contado a partir de `inicio` (o 6º é folga), pula feriado
 *  - 6x1: segunda a sábado, pula feriado
 *  - 12x36: todos os dias, pula feriado
 *  - demais (5x2, jovem_aprendiz): segunda a sexta, pula feriado
 */
export function diasProgramados(regime: string, inicio: string, fim: string, feriados: Set<string>): string[] {
  const out: string[] = []
  let indice = 0
  for (const dia of listarDias(inicio, fim)) {
    const dow = diaSemana(dia)
    const feriado = feriados.has(dia)
    let programado: boolean
    if (regime === '5x1') programado = indice % 6 !== 5 && !feriado
    else if (regime === '6x1') programado = dow !== 0 && !feriado
    else if (regime === '12x36') programado = !feriado
    else programado = dow !== 0 && dow !== 6 && !feriado
    if (programado) out.push(dia)
    indice++
  }
  return out
}
