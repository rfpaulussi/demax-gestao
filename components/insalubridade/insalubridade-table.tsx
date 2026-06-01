'use client'

import { useState, useTransition } from 'react'
import { Plus, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { marcarEnviada, enviarRelatorioRH } from '@/app/(admin)/insalubridade/actions'
import { ModalNovaInsalubridade } from './modal-nova-insalubridade'

export type InsalubridadeRow = {
  id: string
  grau: 'minimo' | 'medio' | 'maximo' | null
  percentual: number | null
  data_inicio: string | null
  data_fim: string | null
  status: 'pendente' | 'enviada' | null
  declaracao_url: string | null
  funcionarios: {
    id: string
    nome: string
    postos: { id: string; nome: string; secretaria: string | null } | null
  } | null
}

const GRAU_BADGE: Record<
  NonNullable<InsalubridadeRow['grau']>,
  { label: string; className: string }
> = {
  minimo: { label: 'Mínimo', className: 'bg-yellow-50 text-yellow-700 ring-yellow-200' },
  medio:  { label: 'Médio',  className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  maximo: { label: 'Máximo', className: 'bg-red-50 text-red-700 ring-red-200'          },
}

const STATUS_BADGE: Record<
  NonNullable<InsalubridadeRow['status']>,
  { label: string; className: string }
> = {
  pendente: { label: 'Pendente', className: 'bg-yellow-50 text-yellow-700 ring-yellow-200' },
  enviada:  { label: 'Enviada',  className: 'bg-green-50 text-green-700 ring-green-200'    },
}

const COLS = ['Funcionário', 'Posto', 'Secretaria', 'Grau', 'Percentual', 'Data Início', 'Data Fim', 'Status', 'Ações']

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

function MarcarEnviadaButton({ registro }: { registro: InsalubridadeRow }) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    const fd = new FormData()
    fd.set('insalubridade_id', registro.id)
    startTransition(() => marcarEnviada(fd))
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={pending}>
      {pending ? 'Salvando...' : 'Marcar Enviada'}
    </Button>
  )
}

function EnviarTodosButton() {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(() => enviarRelatorioRH())
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={pending}>
      <Send className="h-4 w-4" />
      {pending ? 'Enviando...' : 'Enviar Todos ao RH'}
    </Button>
  )
}

export function InsalubridadeTable({ registros }: { registros: InsalubridadeRow[] }) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {registros.length} registro{registros.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          <EnviarTodosButton />
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" />
            Nova Declaração
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {registros.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">
            Nenhuma declaração de insalubridade encontrada.
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
                {registros.map(r => {
                  const grauBadge   = r.grau   ? GRAU_BADGE[r.grau]     : null
                  const statusBadge = r.status ? STATUS_BADGE[r.status] : null
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        {r.funcionarios?.nome ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        {r.funcionarios?.postos?.nome ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        {r.funcionarios?.postos?.secretaria ?? '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {grauBadge ? (
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                              grauBadge.className,
                            )}
                          >
                            {grauBadge.label}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        {r.percentual != null ? `${r.percentual}%` : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{fmt(r.data_inicio)}</td>
                      <td className="px-5 py-3.5 text-gray-500">{fmt(r.data_fim)}</td>
                      <td className="px-5 py-3.5">
                        {statusBadge ? (
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                              statusBadge.className,
                            )}
                          >
                            {statusBadge.label}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {r.status === 'pendente' && <MarcarEnviadaButton registro={r} />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ModalNovaInsalubridade open={showModal} onClose={() => setShowModal(false)} />
    </>
  )
}
