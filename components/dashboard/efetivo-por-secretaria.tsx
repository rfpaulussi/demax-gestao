import { cn } from '@/lib/utils'
import type { SecretariaRow } from '@/app/(admin)/dashboard/actions'

interface EfetivoPorSecretariaProps {
  secretarias: SecretariaRow[]
}

export function EfetivoPorSecretaria({ secretarias }: EfetivoPorSecretariaProps) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
        Efetivo por Secretaria
      </p>

      {secretarias.length === 0 ? (
        <p className="text-sm text-gray-400">Sem dados de secretaria.</p>
      ) : (
        <>
        <ul className="max-h-80 space-y-2.5 overflow-y-auto">
          {secretarias.map(({ nome, previsto, real, pct }) => {
            const deficit  = real < previsto
            const excedente = real > previsto
            const diff     = real - previsto

            const barColor = deficit
              ? pct >= 80 ? 'bg-amber-500' : 'bg-red-500'
              : excedente ? 'bg-blue-400' : 'bg-green-500'

            const nomeColor = deficit ? 'text-gray-700' : 'text-gray-400'
            const pctColor  = deficit
              ? pct >= 80 ? 'text-amber-600' : 'text-red-600'
              : excedente ? 'text-blue-600' : 'text-green-600'

            return (
              <li key={nome}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className={cn('text-xs font-semibold uppercase tracking-widest truncate', nomeColor)}>
                    {nome}
                  </p>
                  <p className="shrink-0 text-xs text-gray-500">
                    {real}/{previsto}{' '}
                    <span className={cn('font-bold', pctColor)}>
                      {excedente ? `+${diff}` : deficit ? `-${previsto - real}` : '✓'}
                    </span>
                  </p>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={cn('h-full rounded-full transition-all', barColor)}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>

        {/* Legenda */}
        <div className="mt-4 flex flex-wrap gap-3 border-t border-gray-50 pt-3">
          {[
            { color: 'bg-green-500',  label: 'Exato' },
            { color: 'bg-blue-400',   label: 'Excedente' },
            { color: 'bg-amber-500',  label: 'Déficit leve (≥80%)' },
            { color: 'bg-red-500',    label: 'Déficit crítico' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', color)} />
              <span className="text-[10px] text-gray-400">{label}</span>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  )
}
