// lib/absenteismo/series.ts
import { maxData, mesAnterior, minData, periodoDoMes } from './datas'
import { calcularPeriodo } from './calculo'
import { calcularKpis } from './kpis'
import type { DadosAbsenteismo } from './tipos'

export interface PontoSerie {
  /** yyyy-mm */
  mes: string
  /** null quando não há dados (mês antes de `dadosDesde` ou depois de hoje) */
  taxa: number | null
  jornadas_perdidas: number
  episodios: number
  parcial: boolean
}

/** `n` meses em ordem crescente, terminando em (ano, mes). */
export function mesesAte(ano: number, mes: number, n: number): { ano: number; mes: number }[] {
  const out: { ano: number; mes: number }[] = []
  let a = ano
  let m = mes
  for (let i = 0; i < n; i++) {
    out.unshift({ ano: a, mes: m })
    const p = mesAnterior(a, m)
    a = p.ano
    m = p.mes
  }
  return out
}

/**
 * Recorta o mês ao intervalo em que há dados: começa em `dadosDesde` e termina em `hoje`.
 * `parcial` é true quando algum recorte foi aplicado. null se o recorte fica vazio.
 */
export function periodoEfetivo(
  inicioMes: string,
  fimMes: string,
  dadosDesde: string,
  hoje: string,
): { inicio: string; fim: string; parcial: boolean } | null {
  const inicio = maxData(inicioMes, dadosDesde)
  const fim = minData(fimMes, hoje)
  if (inicio > fim) return null
  return { inicio, fim, parcial: inicio !== inicioMes || fim !== fimMes }
}

/**
 * Série mensal da taxa. Usa um único mapa de regimes (o que vier em `dados.funcionarios`),
 * aproximação assumida na primeira versão (ver spec, seção 5).
 */
export function calcularSerieMensal(
  dados: DadosAbsenteismo,
  meses: { ano: number; mes: number }[],
  dadosDesde: string,
  hoje: string,
): PontoSerie[] {
  return meses.map(({ ano, mes }) => {
    const rotulo = `${ano}-${String(mes).padStart(2, '0')}`
    const mesCheio = periodoDoMes(ano, mes)
    const p = periodoEfetivo(mesCheio.inicio, mesCheio.fim, dadosDesde, hoje)
    if (!p) return { mes: rotulo, taxa: null, jornadas_perdidas: 0, episodios: 0, parcial: false }
    const r = calcularPeriodo({ ...dados, inicio: p.inicio, fim: p.fim })
    const k = calcularKpis(r)
    return { mes: rotulo, taxa: r.jornadas_programadas === 0 ? null : k.taxa, jornadas_perdidas: k.jornadas_perdidas, episodios: k.episodios, parcial: p.parcial }
  })
}
