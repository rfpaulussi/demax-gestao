// lib/absenteismo/visao.ts
import { calcularPeriodo } from './calculo'
import { calcularKpis, variacaoPercentual, variacaoPontos, type Kpis } from './kpis'
import { composicao, type FatiaComposicao } from './composicao'
import { mapaCalor, type LinhaCalor } from './calor'
import { DADOS_DESDE } from './constantes'
import { periodoDoMes } from './datas'
import { filtrarFuncionarios, type FiltrosAbsenteismo } from './filtros'
import { periodoAnoAnterior, periodoAnterior, type Intervalo } from './periodos'
import { rankingPor, type LinhaRanking } from './ranking'
import { calcularSerieMensal, mesesAte, periodoEfetivo, type PontoSerie } from './series'
import type { DadosAbsenteismo } from './tipos'

export interface VariacoesKpis {
  /** diferença em pontos percentuais */
  taxa_pp: number
  jornadas_perdidas_pct: number | null
  episodios_pct: number | null
  afetados_pct: number | null
  indice_frequencia_pct: number | null
  indice_gravidade_pct: number | null
  duracao_media_pct: number | null
  /** diferença em pontos percentuais */
  reincidencia_pp: number
}

export interface Comparativo {
  periodo: Intervalo
  kpis: Kpis
  variacoes: VariacoesKpis
}

export interface OpcoesFiltro {
  secretarias: string[]
  postos: { id: string; nome: string }[]
  supervisores: { id: string; nome: string }[]
}

export interface VisaoExecutiva {
  mes: number
  ano: number
  periodo: Intervalo & { parcial: boolean }
  /** true quando o mês não tem dados (antes de 18/06/2026, no futuro) ou o recorte não tem quadro */
  semDados: boolean
  kpis: Kpis
  jornadas_programadas: number
  vsMesAnterior: Comparativo | null
  vsAnoAnterior: Comparativo | null
  serie: PontoSerie[]
  composicao: FatiaComposicao[]
  ranking: LinhaRanking[]
  calor: LinhaCalor[]
  opcoes: OpcoesFiltro
}

export function compararKpis(atual: Kpis, anterior: Kpis): VariacoesKpis {
  return {
    taxa_pp: variacaoPontos(atual.taxa, anterior.taxa),
    jornadas_perdidas_pct: variacaoPercentual(atual.jornadas_perdidas, anterior.jornadas_perdidas),
    episodios_pct: variacaoPercentual(atual.episodios, anterior.episodios),
    afetados_pct: variacaoPercentual(atual.funcionarios_afetados, anterior.funcionarios_afetados),
    indice_frequencia_pct: variacaoPercentual(atual.indice_frequencia, anterior.indice_frequencia),
    indice_gravidade_pct: variacaoPercentual(atual.indice_gravidade, anterior.indice_gravidade),
    duracao_media_pct: variacaoPercentual(atual.duracao_media, anterior.duracao_media),
    reincidencia_pp: variacaoPontos(atual.taxa_reincidencia, anterior.taxa_reincidencia),
  }
}

function montarOpcoes(dados: DadosAbsenteismo): OpcoesFiltro {
  const secretarias = new Set<string>()
  const postos = new Map<string, string>()
  const supervisores = new Map<string, string>()
  for (const f of dados.funcionarios) {
    if (f.fora_do_quadro) continue
    if (f.secretaria && f.secretaria !== '—') secretarias.add(f.secretaria)
    if (f.posto_id) postos.set(f.posto_id, f.posto_nome)
    if (f.supervisor_id) supervisores.set(f.supervisor_id, f.supervisor)
  }
  const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, 'pt-BR')
  return {
    secretarias: Array.from(secretarias).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    postos: Array.from(postos.entries()).map(([id, nome]) => ({ id, nome })).sort(porNome),
    supervisores: Array.from(supervisores.entries()).map(([id, nome]) => ({ id, nome })).sort(porNome),
  }
}

/**
 * Monta tudo que a Visão Executiva mostra, a partir dos dados já carregados.
 * `dados` deve cobrir ao menos 13 meses para trás do mês pedido (ou desde DADOS_DESDE) para a série e o ano anterior.
 */
export function montarVisao(entrada: {
  dados: DadosAbsenteismo
  filtros: FiltrosAbsenteismo
  ano: number
  mes: number
  hoje: string
}): VisaoExecutiva {
  const { dados, filtros, ano, mes, hoje } = entrada
  const dadosF: DadosAbsenteismo = { ...dados, funcionarios: filtrarFuncionarios(dados.funcionarios, filtros) }

  const cheio = periodoDoMes(ano, mes)
  const efetivo = periodoEfetivo(cheio.inicio, cheio.fim, DADOS_DESDE, hoje)
  const periodo = efetivo ?? { inicio: cheio.inicio, fim: cheio.fim, parcial: false }

  const calcular = (d: DadosAbsenteismo, i: Intervalo) => calcularPeriodo({ ...d, inicio: i.inicio, fim: i.fim })

  const atual = efetivo ? calcular(dadosF, periodo) : calcular({ ...dadosF, funcionarios: [] }, periodo)
  const kpis = calcularKpis(atual)

  const comparar = (i: Intervalo | null): Comparativo | null => {
    if (!i || !efetivo) return null
    const k = calcularKpis(calcular(dadosF, i))
    return { periodo: i, kpis: k, variacoes: compararKpis(kpis, k) }
  }

  const vsMesAnterior = comparar(efetivo ? periodoAnterior(periodo, ano, mes, DADOS_DESDE, hoje) : null)
  const vsAnoAnterior = comparar(efetivo ? periodoAnoAnterior(periodo, ano, mes, DADOS_DESDE, hoje) : null)

  // o ranking compara as secretarias entre si: ignora só o filtro de secretaria
  const paraRanking = { ...dados, funcionarios: filtrarFuncionarios(dados.funcionarios, { ...filtros, secretaria: null }) }

  return {
    mes,
    ano,
    periodo,
    semDados: !efetivo || atual.quadro_medio === 0,
    kpis,
    jornadas_programadas: atual.jornadas_programadas,
    vsMesAnterior,
    vsAnoAnterior,
    serie: calcularSerieMensal(dadosF, mesesAte(ano, mes, 12), DADOS_DESDE, hoje),
    composicao: composicao(atual),
    ranking: efetivo ? rankingPor('secretaria', { ...paraRanking, inicio: periodo.inicio, fim: periodo.fim }) : [],
    calor: mapaCalor(atual),
    opcoes: montarOpcoes(dados),
  }
}
