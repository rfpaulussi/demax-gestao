import { DIAS_SEMANA, type CamposAcordo, type FuncionarioCalc } from './tipos'
import { addDias } from './tempo'
import { jornadaDiaMin } from './horario-do-turno'
import { agruparPorJornada, datasDeFolga, datasDoEvento, jornadaDoDia, origemDoDia, resumoCalculo } from './movimentos'
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
  /** Quantidade de dias pedida pelo usuário; sem ela, a menor que divide certo para todos os turnos. */
  quantidade?: number,
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
  const n = quantidade ?? sugerirQuantidadeDiasComum(totais, maxPorDia)
  if (n === null) return []
  if (c.template !== 'T4') return proximosDiasUteis(base, n, funcs, feriados)
  const dias = diasUteisAnteriores(base, n, funcs, feriados)
  return hoje && dias.some(d => d < hoje) ? [] : dias
}

/**
 * Por que não há sugestão de dias (para explicar ao usuário em vez de só pedir "informe um dia").
 * null quando faltam dados básicos ou quando há sugestão.
 */
export function motivoSemSugestao(
  c: CamposAcordo,
  funcs: FuncionarioCalc[],
  feriados: MapaFeriados,
  hoje?: string,
): string | null {
  if (c.template === 'T5' || funcs.length === 0) return null
  const grupos = agruparPorJornada(c, funcs)
  const totais = grupos.map(g => resumoCalculo(c, g).horasTotalMin)
  if (totais.length === 0 || totais.some(t => t <= 0)) return null
  if (sugerirDiasAjuste(c, funcs, feriados, hoje).length > 0) return null
  if (c.template === 'T1' && funcs.some(f => datasDoEvento(c).some(d => origemDoDia(c, f, d) > MAX_JORNADA_DIA_MIN))) {
    return 'As horas trabalhadas num dia do evento passam de 10h. Revise o período ou as horas.'
  }
  const jornadaMax = Math.max(0, ...funcs.flatMap(f => DIAS_SEMANA.map(dia => jornadaDiaMin(f.semana[dia]))))
  const maxPorDia = c.template === 'T1' ? 60 : Math.min(MAX_ACRESCIMO_DIA_MIN, MAX_JORNADA_DIA_MIN - jornadaMax)
  if (maxPorDia <= 0) return 'A jornada de algum turno já chega a 10h: não há margem para acréscimo. Escolha os dias manualmente.'
  const maior = Math.max(...totais)
  if (Math.ceil(maior / maxPorDia) > 31) {
    return `São ${Math.floor(maior / 60)}h${String(maior % 60).padStart(2, '0')} a compensar e o limite é ${maxPorDia} min por dia (mais de 31 dias). Reduza as horas ou escolha os dias manualmente.`
  }
  if (c.template === 'T4') {
    const h = `${Math.floor(maior / 60)}h${String(maior % 60).padStart(2, '0')}`
    return `Para folgar nesse dia é preciso trabalhar ${h} a mais antes dele (no máximo ${maxPorDia} min por dia), mas não há dias úteis suficientes entre hoje e a folga. Escolha uma folga mais adiante ou adicione os dias manualmente.`
  }
  return 'Não há uma quantidade de dias que divida certo para todos os turnos. Escolha os dias manualmente.'
}
