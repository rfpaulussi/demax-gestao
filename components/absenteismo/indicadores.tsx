// components/absenteismo/indicadores.tsx
import type { Kpis } from '@/lib/absenteismo/kpis'
import { fmtDec } from '@/lib/absenteismo/formatar'
import type { Comparativo } from '@/lib/absenteismo/visao'
import { InfoTip } from './info-tip'
import { VariacaoBadge } from './variacao-badge'

interface Props {
  kpis: Kpis
  vs: Comparativo | null
  rotuloVs: string
}

export function Indicadores({ kpis, vs, rotuloVs }: Props) {
  const v = vs?.variacoes
  const linhas = [
    {
      titulo: 'Índice de frequência (IF)',
      dica: 'Episódios ÷ quadro médio × 100. Quantas ausências ocorreram para cada 100 funcionários no período.',
      valor: fmtDec(kpis.indice_frequencia, 1),
      variacao: v?.indice_frequencia_pct ?? null,
      tipo: 'pct' as const,
    },
    {
      titulo: 'Índice de gravidade (IG)',
      dica: 'Jornadas perdidas ÷ quadro médio × 100. Quantas jornadas de trabalho foram perdidas para cada 100 funcionários.',
      valor: fmtDec(kpis.indice_gravidade, 1),
      variacao: v?.indice_gravidade_pct ?? null,
      tipo: 'pct' as const,
    },
    {
      titulo: 'Duração média por ocorrência',
      dica: 'Jornadas perdidas ÷ episódios. Quanto dura, em média, cada ausência.',
      valor: `${fmtDec(kpis.duracao_media, 1)} jornadas`,
      variacao: v?.duracao_media_pct ?? null,
      tipo: 'pct' as const,
    },
    {
      titulo: 'Taxa de reincidência',
      dica: 'Funcionários com 2 ou mais episódios no período ÷ funcionários afetados × 100.',
      valor: `${fmtDec(kpis.taxa_reincidencia, 1)}%`,
      variacao: v?.reincidencia_pp ?? null,
      tipo: 'pp' as const,
    },
  ]

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">Principais indicadores</p>
      <dl className="divide-y divide-gray-100">
        {linhas.map(l => (
          <div key={l.titulo} className="py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-sm text-gray-600">
                {l.titulo}
                <InfoTip texto={l.dica} />
              </dt>
              <dd className="text-base font-bold text-gray-900">{l.valor}</dd>
            </div>
            <VariacaoBadge valor={l.variacao} tipo={l.tipo} rotulo={rotuloVs} />
          </div>
        ))}
      </dl>
    </div>
  )
}
