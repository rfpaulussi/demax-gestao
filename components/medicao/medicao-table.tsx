'use client'

import { useState, useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { gerarSnapshot } from '@/app/(admin)/medicao/actions'

export type MedicaoRow = {
  posto_id:         string
  posto_nome:       string
  secretaria:       string | null
  efetivo_previsto: number
  efetivo_real:     number
  diferenca:        number
  situacao:         'completo' | 'deficit' | 'excesso'
}

const SITUACAO_BADGE: Record<
  MedicaoRow['situacao'],
  { label: string; className: string }
> = {
  completo: { label: 'Completo', className: 'bg-green-50 text-green-700 ring-green-200'    },
  deficit:  { label: 'Déficit',  className: 'bg-red-50 text-red-700 ring-red-200'          },
  excesso:  { label: 'Excesso',  className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
}

const ROW_BG: Record<MedicaoRow['situacao'], string> = {
  completo: 'hover:bg-gray-50',
  deficit:  'bg-red-50/50 hover:bg-red-50',
  excesso:  'bg-indigo-50/50 hover:bg-indigo-50',
}

const COLS = ['Posto', 'Secretaria', 'Previsto', 'Real', 'Diferença', 'Situação']

const labelClass = 'text-xs font-semibold uppercase tracking-widest text-gray-400'
const selectClass =
  'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

function GerarSnapshotButton() {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => startTransition(() => gerarSnapshot())}
      disabled={pending}
    >
      <RefreshCw className={cn('h-4 w-4', pending && 'animate-spin')} />
      {pending ? 'Gerando...' : 'Gerar Snapshot do Mês'}
    </Button>
  )
}

export function MedicaoTable({
  rows,
  secretarias,
}: {
  rows: MedicaoRow[]
  secretarias: string[]
}) {
  const [filterSecretaria, setFilterSecretaria] = useState('')
  const [filterSituacao, setFilterSituacao]     = useState('')

  const filtered = rows.filter(r => {
    if (filterSecretaria && r.secretaria !== filterSecretaria) return false
    if (filterSituacao   && r.situacao   !== filterSituacao)   return false
    return true
  })

  const hasFilter = Boolean(filterSecretaria || filterSituacao)

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className={labelClass}>Secretaria</label>
            <select
              value={filterSecretaria}
              onChange={e => setFilterSecretaria(e.target.value)}
              className={selectClass}
            >
              <option value="">Todas</option>
              {secretarias.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Situação</label>
            <select
              value={filterSituacao}
              onChange={e => setFilterSituacao(e.target.value)}
              className={selectClass}
            >
              <option value="">Todas</option>
              <option value="completo">Completo</option>
              <option value="deficit">Déficit</option>
              <option value="excesso">Excesso</option>
            </select>
          </div>

          {hasFilter && (
            <button
              onClick={() => { setFilterSecretaria(''); setFilterSituacao('') }}
              className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-400 hover:bg-gray-50"
            >
              Limpar
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <p className={labelClass}>
            {filtered.length} posto{filtered.length !== 1 ? 's' : ''}
          </p>
          <GerarSnapshotButton />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">
            Nenhum posto encontrado com os filtros aplicados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  {COLS.map(h => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(r => {
                  const badge      = SITUACAO_BADGE[r.situacao]
                  const diffLabel  = r.diferenca > 0 ? `+${r.diferenca}` : String(r.diferenca)
                  const diffClass  =
                    r.diferenca > 0
                      ? 'text-green-600 font-semibold'
                      : r.diferenca < 0
                        ? 'text-red-600 font-semibold'
                        : 'text-gray-400'

                  return (
                    <tr key={r.posto_id} className={cn('transition-colors', ROW_BG[r.situacao])}>
                      <td className="px-5 py-3.5 font-medium text-gray-900">{r.posto_nome}</td>
                      <td className="px-5 py-3.5 text-gray-500">{r.secretaria ?? '—'}</td>
                      <td className="px-5 py-3.5 tabular-nums text-gray-500">{r.efetivo_previsto}</td>
                      <td className="px-5 py-3.5 tabular-nums text-gray-500">{r.efetivo_real}</td>
                      <td className={cn('px-5 py-3.5 tabular-nums', diffClass)}>{diffLabel}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                            badge.className,
                          )}
                        >
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
