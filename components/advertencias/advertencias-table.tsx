'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { downloadAdvertenciaPDF } from './advertencia-pdf'
import { marcarEntregue, marcarGerada } from '@/app/(admin)/advertencias/actions'
import type { AdvertenciaCompleta } from '@/app/(admin)/advertencias/actions'

const GRAU_BADGE: Record<string, { label: string; cls: string }> = {
  verbal:    { label: 'Verbal',    cls: 'bg-yellow-50 text-yellow-700 ring-yellow-200' },
  escrita:   { label: 'Escrita',   cls: 'bg-orange-50 text-orange-700 ring-orange-200' },
  suspensao: { label: 'Suspensão', cls: 'bg-red-50 text-red-700 ring-red-200'          },
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pendente: { label: 'Pendente', cls: 'bg-gray-50 text-gray-600 ring-gray-200'    },
  gerada:   { label: 'Gerada',   cls: 'bg-blue-50 text-blue-700 ring-blue-200'    },
  entregue: { label: 'Entregue', cls: 'bg-green-50 text-green-700 ring-green-200' },
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

interface Props {
  advertencias: AdvertenciaCompleta[]
  reincidencias: Record<string, number>
}

export function AdvertenciasTable({ advertencias, reincidencias }: Props) {
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null)

  async function handleDownloadPDF(adv: AdvertenciaCompleta) {
    setLoadingPdf(adv.id)
    try {
      await downloadAdvertenciaPDF(adv)
    } finally {
      setLoadingPdf(null)
    }
  }

  if (advertencias.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm">
        <p className="text-sm text-gray-400">Nenhuma advertência encontrada.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Colaborador', 'Posto', 'Secretaria', 'Grau', 'Ocorrência', 'Status', 'Reinc.', 'Ações'].map(h => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {advertencias.map(adv => {
              const reinc = reincidencias[adv.funcionario_id] ?? 1
              const isReinc = reinc > 1
              const grauKey = adv.grau ?? (adv.tipo as string) ?? ''
              const grauBadge = GRAU_BADGE[grauKey] ?? { label: grauKey || '—', cls: 'bg-gray-50 text-gray-600 ring-gray-200' }
              const statusBadge = STATUS_BADGE[adv.status ?? 'pendente'] ?? STATUS_BADGE.pendente

              return (
                <tr
                  key={adv.id}
                  className={cn(
                    'transition-colors hover:bg-gray-50/80',
                    isReinc && 'bg-red-50 hover:bg-red-100/60'
                  )}
                >
                  <td
                    className={cn(
                      'px-4 py-3 font-medium text-gray-900',
                      isReinc && 'border-l-[3px] border-l-red-400'
                    )}
                  >
                    {adv.funcionarios?.nome ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{adv.funcionarios?.postos?.nome ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{adv.funcionarios?.postos?.secretaria ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', grauBadge.cls)}>
                      {grauBadge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{fmt(adv.data_ocorrencia)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', statusBadge.cls)}>
                      {statusBadge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isReinc ? (
                      <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                        {reinc}ª vez
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">1ª vez</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownloadPDF(adv)}
                        disabled={loadingPdf === adv.id}
                        className="flex h-7 items-center rounded-md bg-amber-500 px-2.5 text-xs font-semibold text-slate-900 transition-colors hover:bg-amber-400 disabled:opacity-50"
                      >
                        {loadingPdf === adv.id ? '...' : 'PDF'}
                      </button>
                      {adv.status === 'pendente' && (
                        <form action={marcarGerada}>
                          <input type="hidden" name="advertencia_id" value={adv.id} />
                          <button
                            type="submit"
                            className="flex h-7 items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                          >
                            Gerar
                          </button>
                        </form>
                      )}
                      {adv.status === 'gerada' && (
                        <form action={marcarEntregue}>
                          <input type="hidden" name="advertencia_id" value={adv.id} />
                          <button
                            type="submit"
                            className="flex h-7 items-center rounded-md border border-green-200 bg-green-50 px-2.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100"
                          >
                            Entregar
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
