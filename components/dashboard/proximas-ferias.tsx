import { cn } from '@/lib/utils'
import type { ProximaFerias } from '@/app/(admin)/dashboard/actions'

interface ProximasFeriasProps {
  ferias: ProximaFerias[]
}

function formatNome(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  if (partes.length === 1) return partes[0]
  return `${partes[0]} ${partes[partes.length - 1]}`
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0][0].toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function formatDia(iso: string): string {
  const [, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}`
}

const STATUS_BADGE: Record<string, string> = {
  agendado: 'bg-blue-50 text-blue-700 ring-blue-200',
  aprovado: 'bg-green-50 text-green-700 ring-green-200',
}

const STATUS_LABEL: Record<string, string> = {
  agendado: 'Agendado',
  aprovado: 'Aprovado',
}

export function ProximasFerias({ ferias }: ProximasFeriasProps) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
        Próximas Férias — 7 Dias
      </p>

      {ferias.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhuma férias nos próximos 7 dias.</p>
      ) : (
        <ul className="max-h-80 divide-y divide-gray-50 overflow-y-auto">
          {ferias.slice(0, 7).map(f => {
            const badgeClass = STATUS_BADGE[f.status] ?? 'bg-gray-50 text-gray-600 ring-gray-200'
            const badgeLabel = STATUS_LABEL[f.status] ?? f.status
            return (
              <li key={f.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-medium text-blue-700">
                    {iniciais(f.funcionarioNome)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {formatNome(f.funcionarioNome)}
                    </p>
                    <p className="truncate text-xs text-gray-400">
                      {[f.postoNome, f.secretaria].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
                <div className="ml-3 flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
                      badgeClass
                    )}
                  >
                    {badgeLabel}
                  </span>
                  <span className="text-xs text-gray-400">{formatDia(f.dataInicio)}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
