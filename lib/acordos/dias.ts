import type { FuncionarioCalc } from './tipos'
import { addDias } from './tempo'
import { jornadaDoDia } from './movimentos'
import type { MapaFeriados } from './validar'

/** Menor quantidade de dias (até `maxDias`) que divide `totalMin` exatamente sem passar de `maxPorDiaMin` por dia. */
export function sugerirQuantidadeDias(totalMin: number, maxPorDiaMin: number, maxDias = 31): number | null {
  for (let n = 1; n <= maxDias; n++) {
    if (totalMin % n === 0 && totalMin / n <= maxPorDiaMin) return n
  }
  return null
}

/** Próximos `quantidade` dias (depois de `inicio`) em que todos trabalham e que não constam no calendário. */
export function proximosDiasUteis(
  inicio: string,
  quantidade: number,
  funcs: FuncionarioCalc[],
  feriados: MapaFeriados,
): string[] {
  const out: string[] = []
  let d = inicio
  for (let i = 0; i < 400 && out.length < quantidade; i++) {
    d = addDias(d, 1)
    if (feriados.has(d)) continue
    if (funcs.length > 0 && funcs.every(f => jornadaDoDia(f, d) > 0)) out.push(d)
  }
  return out
}
