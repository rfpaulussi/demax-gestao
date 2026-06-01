'use client'

import { useState, useTransition } from 'react'
import { FileText, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { marcarEntregue } from '@/app/(admin)/advertencias/actions'
import { ModalNovaAdvertencia } from './modal-nova-advertencia'

export type AdvertenciaRow = {
  id: string
  tipo: string | null
  data_ocorrencia: string | null
  status: 'pendente' | 'gerada' | 'entregue' | null
  pdf_url: string | null
  descricao: string | null
  funcionarios: {
    id: string
    nome: string
    postos: { nome: string; secretaria: string | null } | null
  } | null
}

const STATUS_BADGE: Record<
  NonNullable<AdvertenciaRow['status']>,
  { label: string; className: string }
> = {
  pendente: { label: 'Pendente', className: 'bg-yellow-50 text-yellow-700 ring-yellow-200' },
  gerada:   { label: 'Gerada',   className: 'bg-blue-50 text-blue-700 ring-blue-200'       },
  entregue: { label: 'Entregue', className: 'bg-green-50 text-green-700 ring-green-200'    },
}

const COLS = ['Funcionário', 'Posto', 'Tipo', 'Data Ocorrência', 'Status', 'PDF', 'Ações']

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

function EntregarButton({ advertencia }: { advertencia: AdvertenciaRow }) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    const fd = new FormData()
    fd.set('advertencia_id', advertencia.id)
    startTransition(() => marcarEntregue(fd))
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={pending}>
      {pending ? 'Salvando...' : 'Marcar Entregue'}
    </Button>
  )
}

export function AdvertenciasTable({ advertencias }: { advertencias: AdvertenciaRow[] }) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {advertencias.length} advertência{advertencias.length !== 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4" />
          Nova Advertência
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {advertencias.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">
            Nenhuma advertência encontrada.
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
              <tbody className="divide-y divide-gray-50">
                {advertencias.map(a => {
                  const badge = a.status ? STATUS_BADGE[a.status] : null
                  return (
                    <tr key={a.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        {a.funcionarios?.nome ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        <div>{a.funcionarios?.postos?.nome ?? '—'}</div>
                        {a.funcionarios?.postos?.secretaria && (
                          <div className="text-xs text-gray-400">{a.funcionarios.postos.secretaria}</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{a.tipo ?? '—'}</td>
                      <td className="px-5 py-3.5 text-gray-500">{fmt(a.data_ocorrencia)}</td>
                      <td className="px-5 py-3.5">
                        {badge ? (
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                              badge.className,
                            )}
                          >
                            {badge.label}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {a.pdf_url ? (
                          <a
                            href={a.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          >
                            <FileText className="h-4 w-4" />
                            <span className="text-xs">PDF</span>
                          </a>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {a.status === 'gerada' && <EntregarButton advertencia={a} />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ModalNovaAdvertencia open={showModal} onClose={() => setShowModal(false)} />
    </>
  )
}
