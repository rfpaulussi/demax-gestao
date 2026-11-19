// components/absenteismo/visao-executiva.tsx
import { fmtDec, fmtInt, fmtPct, fmtPeriodo, rotuloMes } from '@/lib/absenteismo/formatar'
import type { ParametrosTela } from '@/lib/absenteismo/parametros'
import type { VisaoExecutiva } from '@/lib/absenteismo/visao'
import { GraficoComposicao } from './grafico-composicao'
import { GraficoEvolucao } from './grafico-evolucao'
import { Indicadores } from './indicadores'
import { KpiCard } from './kpi-card'
import { MapaCalor } from './mapa-calor'
import { RankingSecretaria } from './ranking-secretaria'
import { VariacaoBadge } from './variacao-badge'

export function VisaoExecutivaView({ visao, params }: { visao: VisaoExecutiva; params: ParametrosTela }) {
  const { kpis, vsMesAnterior, vsAnoAnterior } = visao
  const rotuloMesAnt = vsMesAnterior
    ? `vs ${rotuloMes(vsMesAnterior.periodo.inicio.slice(0, 7))}`
    : 'vs mês anterior'
  const rotuloAnoAnt = `vs mesmo mês de ${visao.ano - 1}`
  const v = vsMesAnterior?.variacoes

  if (visao.semDados) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm">
        <p className="text-sm font-medium text-gray-700">Sem dados para o período e os filtros selecionados.</p>
        <p className="mt-1 text-xs text-gray-400">
          Os registros de ausência começam em 18/06/2026. Verifique o mês, o ano e os filtros.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Período: <strong className="text-gray-700">{fmtPeriodo(visao.periodo.inicio, visao.periodo.fim)}</strong>
        {visao.periodo.parcial ? ' (parcial)' : ''} · Quadro médio:{' '}
        <strong className="text-gray-700">{fmtInt(kpis.quadro_medio)}</strong> · Jornadas programadas:{' '}
        <strong className="text-gray-700">{fmtInt(visao.jornadas_programadas)}</strong>
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          titulo="Taxa de absenteísmo"
          valor={fmtPct(kpis.taxa)}
          cor="border-t-orange-500"
          dica="Jornadas perdidas ÷ jornadas programadas × 100. A base é a escala de cada funcionário (5x2, 5x1, 6x1, 12x36), sem férias e sem afastamentos. Só entram faltas e atestados (até o 15º dia)."
        >
          <VariacaoBadge valor={v?.taxa_pp ?? null} tipo="pp" rotulo={rotuloMesAnt} />
          <VariacaoBadge valor={vsAnoAnterior?.variacoes.taxa_pp ?? null} tipo="pp" rotulo={rotuloAnoAnt} />
        </KpiCard>
        <KpiCard
          titulo="Jornadas perdidas"
          valor={fmtInt(kpis.jornadas_perdidas)}
          cor="border-t-red-500"
          dica="Dias de trabalho previstos na escala em que o funcionário esteve ausente (falta ou atestado). Cada dia conta uma vez só, mesmo que haja dois registros no mesmo dia."
        >
          <VariacaoBadge valor={v?.jornadas_perdidas_pct ?? null} tipo="pct" rotulo={rotuloMesAnt} />
        </KpiCard>
        <KpiCard
          titulo="Episódios"
          valor={fmtInt(kpis.episodios)}
          cor="border-t-amber-500"
          dica="Quantidade de ausências distintas. Cada falta é um episódio; atestados em sequência (emendados) formam um só."
        >
          <VariacaoBadge valor={v?.episodios_pct ?? null} tipo="pct" rotulo={rotuloMesAnt} />
        </KpiCard>
        <KpiCard
          titulo="Funcionários afetados"
          valor={fmtInt(kpis.funcionarios_afetados)}
          cor="border-t-slate-500"
          dica="Funcionários distintos com pelo menos um episódio no período."
        >
          <p className="mt-1 text-xs text-gray-400">{fmtDec(kpis.pct_afetados, 1)}% do quadro</p>
          <VariacaoBadge valor={v?.afetados_pct ?? null} tipo="pct" rotulo={rotuloMesAnt} />
        </KpiCard>
        <KpiCard
          titulo="Índice de frequência"
          valor={fmtDec(kpis.indice_frequencia, 1)}
          cor="border-t-indigo-500"
          dica="Episódios ÷ quadro médio × 100. Quantas ausências ocorreram para cada 100 funcionários."
        >
          <VariacaoBadge valor={v?.indice_frequencia_pct ?? null} tipo="pct" rotulo={rotuloMesAnt} />
        </KpiCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <GraficoEvolucao serie={visao.serie} />
        </div>
        <div className="min-w-0">
          <GraficoComposicao fatias={visao.composicao} total={kpis.jornadas_perdidas} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0">
          <Indicadores kpis={kpis} vs={vsMesAnterior} rotuloVs={rotuloMesAnt} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <RankingSecretaria linhas={visao.ranking} taxaGeral={kpis.taxa} params={params} />
        </div>
      </div>

      <MapaCalor linhas={visao.calor} totalEpisodios={kpis.episodios} />

      <p className="text-xs text-gray-400">
        Não entram na taxa: afastamentos (INSS e licenças), atestados após o 15º dia, férias e suspensões disciplinares.
        O comparativo com o mês anterior usa o mesmo número de dias quando o mês atual ainda está em andamento.
      </p>
    </div>
  )
}
