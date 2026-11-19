// components/absenteismo/mapa-calor.tsx
import { DIAS_SEMANA, type LinhaCalor } from '@/lib/absenteismo/calor'
import { fmtInt } from '@/lib/absenteismo/formatar'
import { InfoTip } from './info-tip'

export function MapaCalor({ linhas, totalEpisodios }: { linhas: LinhaCalor[]; totalEpisodios: number }) {
  const maximo = Math.max(...linhas.flatMap(l => l.porDia), 0)
  const total = linhas.reduce((s, l) => s + l.total, 0)
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500">
        Mapa de calor: ocorrências por dia da semana
        <InfoTip texto="Quantidade de episódios (ausências) que começaram em cada dia da semana. Falta: dia da falta. Atestado: primeiro dia do atestado (atestados emendados contam como um episódio). Só entram episódios que começaram dentro do período." />
      </p>
      {total === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Nenhuma ocorrência começou no período.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '460px' }}>
              <thead>
                <tr className="text-xs uppercase tracking-widest text-gray-400">
                  <th className="pb-2 pr-3 text-left font-semibold" />
                  {DIAS_SEMANA.map(d => (
                    <th key={d} className="pb-2 text-center font-semibold">{d}</th>
                  ))}
                  <th className="pb-2 pl-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(l => (
                  <tr key={l.classe}>
                    <td className="whitespace-nowrap py-1 pr-3 text-gray-600">{l.rotulo}</td>
                    {l.porDia.map((n, i) => (
                      <td key={i} className="p-0.5 text-center">
                        <div
                          className="rounded py-1.5 text-xs font-semibold text-gray-800"
                          style={{ backgroundColor: n === 0 ? '#f8fafc' : `rgba(220, 38, 38, ${0.12 + 0.6 * (n / maximo)})` }}
                          title={`${l.rotulo} · ${DIAS_SEMANA[i]}: ${n}`}
                        >
                          {n === 0 ? '·' : fmtInt(n)}
                        </div>
                      </td>
                    ))}
                    <td className="py-1 pl-3 text-right font-semibold text-gray-900">{fmtInt(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            {total < totalEpisodios
              ? `${fmtInt(total)} de ${fmtInt(totalEpisodios)} episódios — ${fmtInt(totalEpisodios - total)} começaram antes do período e não entram no mapa.`
              : `${fmtInt(total)} episódios que começaram no período.`}
          </p>
        </>
      )}
    </div>
  )
}
