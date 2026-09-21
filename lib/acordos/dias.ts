import { DIAS_SEMANA, type CamposAcordo, type FuncionarioCalc } from './tipos'
import { addDias } from './tempo'
import { jornadaDiaMin } from './horario-do-turno'
import { agruparPorJornada, datasDeFolga, datasDoEvento, jornadaDoDia, resumoCalculo } from './movimentos'
import { MAX_ACRESCIMO_DIA_MIN, MAX_JORNADA_DIA_MIN } from './regras'
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

/** Menor quantidade de dias que serve a TODOS os totais (divide exato e respeita o máximo por dia). */
export function sugerirQuantidadeDiasComum(totais: number[], maxPorDiaMin: number, maxDias = 31): number | null {
  if (totais.length === 0 || totais.some(t => t <= 0)) return null
  for (let n = 1; n <= maxDias; n++) {
    if (totais.every(t => t % n === 0 && t / n <= maxPorDiaMin)) return n
  }
  return null
}

/** `quantidade` dias úteis imediatamente antes de `fim` (todos trabalham; fora do calendário), em ordem crescente. */
export function diasUteisAnteriores(
  fim: string,
  quantidade: number,
  funcs: FuncionarioCalc[],
  feriados: MapaFeriados,
): string[] {
  const out: string[] = []
  let d = fim
  for (let i = 0; i < 400 && out.length < quantidade; i++) {
    d = addDias(d, -1)
    if (feriados.has(d)) continue
    if (funcs.length > 0 && funcs.every(f => jornadaDoDia(f, d) > 0)) out.push(d)
  }
  return out.reverse()
}

/**
 * Dias de compensação/acréscimo sugeridos; [] no T5 ou quando faltam dados.
 * No T4, com `hoje` informado, só valem dias >= hoje: se não houver `n` dias úteis até a folga, devolve [].
 */
export function sugerirDiasAjuste(
  c: CamposAcordo,
  funcs: FuncionarioCalc[],
  feriados: MapaFeriados,
  hoje?: string,
): string[] {
  if (c.template === 'T5') return []
  // Revezamento: reposição depois da última folga; acréscimo (T4) antes da primeira
  const folgas = datasDeFolga(c)
  const eventos = datasDoEvento(c)
  const base = c.template === 'T1' || c.template === 'T2'
    ? eventos[eventos.length - 1]
    : c.template === 'T3' ? folgas[folgas.length - 1] : folgas[0]
  if (!base) return []
  const grupos = agruparPorJornada(c, funcs)
  if (grupos.length === 0) return []
  const totais = grupos.map(g => resumoCalculo(c, g).horasTotalMin)
  if (totais.some(t => t <= 0)) return []
  const jornadaMax = Math.max(
    0,
    ...funcs.flatMap(f => DIAS_SEMANA.map(dia => jornadaDiaMin(f.semana[dia]))),
  )
  const maxPorDia = c.template === 'T1'
    ? 60
    : Math.min(MAX_ACRESCIMO_DIA_MIN, MAX_JORNADA_DIA_MIN - jornadaMax)
  const n = sugerirQuantidadeDiasComum(totais, maxPorDia)
  if (n === null) return []
  if (c.template !== 'T4') return proximosDiasUteis(base, n, funcs, feriados)
  const dias = diasUteisAnteriores(base, n, funcs, feriados)
  return hoje && dias.some(d => d < hoje) ? [] : dias
}
