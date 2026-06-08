import type { AtestadoRecente } from '@/app/(admin)/dashboard/actions'

interface AtestadosRecentesProps {
  atestados: AtestadoRecente[]
}

function formatDia(iso: string): string {
  const str = iso.includes('T') ? iso.split('T')[0] : iso
  const [, m, d] = str.split('-')
  return `${d}/${m}`
}

export function AtestadosRecentes({ atestados }: AtestadosRecentesProps) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
        Atestados Recentes — 7 Dias
      </p>

      {atestados.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhum atestado nos últimos 7 dias.</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {atestados.map(a => {
            const meta = [a.supervisorNome, a.secretaria].filter(Boolean).join(' · ')
            return (
              <li key={a.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{a.funcionarioNome}</p>
                  {meta && <p className="truncate text-xs text-gray-400">{meta}</p>}
                </div>
                <div className="ml-3 flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-xs font-semibold text-gray-700">
                    {a.duracao} dia{a.duracao > 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDia(a.dataInicio)} → {formatDia(a.dataFim)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
