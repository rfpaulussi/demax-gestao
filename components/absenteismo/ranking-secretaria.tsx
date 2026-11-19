// components/absenteismo/ranking-secretaria.tsx
import Link from 'next/link'
import { fmtInt, fmtPct } from '@/lib/absenteismo/formatar'
import { montarQuery, type ParametrosTela } from '@/lib/absenteismo/parametros'
import type { LinhaRanking } from '@/lib/absenteismo/ranking'
import { InfoTip } from './info-tip'

interface Props {
  linhas: LinhaRanking[]
  taxaGeral: number
  params: ParametrosTela
}

export function RankingSecretaria({ linhas, taxaGeral, params }: Props) {
  const maior = Math.max(...linhas.map(l => l.taxa), 0.0001)
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500">
        Ranking por secretaria
        <InfoTip texto="Taxa de absenteísmo de cada secretaria no período, calculada sobre o quadro dela (não sobre o número bruto de faltas). Clique numa linha para filtrar a tela." />
      </p>
      {linhas.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Sem dados no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '420px' }}>
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-gray-400">
                <th className="pb-2 pr-2 font-semibold">#</th>
                <th className="pb-2 pr-2 font-semibold">Secretaria</th>
                <th className="pb-2 pr-2 text-right font-semibold">Quadro</th>
                <th className="pb-2 pr-2 text-right font-semibold">Jornadas</th>
                <th className="pb-2 font-semibold">Taxa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {linhas.map((l, i) => {
                const ativa = params.filtros.secretaria === l.valor
                const acima = taxaGeral > 0 && l.taxa > taxaGeral * 1.5
                return (
                  <tr key={l.valor} className={ativa ? 'bg-slate-50' : 'hover:bg-gray-50/80'}>
                    <td className="py-2 pr-2 text-gray-400">{i + 1}</td>
                    <td className="py-2 pr-2 font-medium text-gray-900">
                      <Link href={`?${montarQuery(params, { secretaria: ativa ? null : l.valor })}`} className="hover:underline">
                        {l.valor}
                      </Link>
                    </td>
                    <td className="py-2 pr-2 text-right text-gray-600">{fmtInt(l.quadro_medio)}</td>
                    <td className="py-2 pr-2 text-right text-gray-600">{fmtInt(l.jornadas_perdidas)}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={acima ? 'h-full bg-red-500' : 'h-full bg-slate-400'}
                            style={{ width: `${Math.max(2, (l.taxa / maior) * 100)}%` }}
                          />
                        </div>
                        <span className={acima ? 'font-semibold text-red-600' : 'text-gray-700'}>{fmtPct(l.taxa)}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
