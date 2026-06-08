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
        <ul className="max-h-80 space-y-4 overflow-y-auto">
          {secretarias.map(({ nome, previsto, real, pct }) => {
            const isPleno = pct >= 100
            const barColor =
              pct >= 95
                ? 'bg-green-500'
                : pct >= 80
                  ? 'bg-amber-500'
                  : 'bg-red-500'

            return (
              <li key={nome}>
                <div className="mb-1.5 flex items-center justify-between">
                  <p
                    className={cn(
                      'text-xs font-semibold uppercase tracking-widest',
                      isPleno ? 'text-gray-400' : 'text-gray-600'
                    )}
                  >
                    {nome}
                  </p>
                  <p className={cn('text-xs', isPleno ? 'text-gray-400' : 'text-gray-500')}>
                    {real}/{previsto}{' '}
                    <span className={cn('font-semibold', isPleno ? 'text-gray-400' : 'text-gray-700')}>
                      {pct}%
                    </span>
                  </p>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={cn('h-full rounded-full transition-all', barColor)}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
