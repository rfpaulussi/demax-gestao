'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { marcarEnviado, removerDia } from '@/app/(admin)/insalubridade/actions'
import { ModalNovaInsalubridade } from './modal-nova-insalubridade'
import { downloadDeclaracaoPDF } from './declaracao-insalubridade-pdf'
import type { InsalubridadeGrupo, InsalubridadeCobertura, FuncOpt } from '@/app/(admin)/insalubridade/actions'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pendente: { label: 'Pendente', cls: 'bg-amber-50 text-amber-700 ring-amber-200'  },
  enviado:  { label: 'Enviado',  cls: 'bg-green-50 text-green-700 ring-green-200'  },
  pago:     { label: 'Pago',     cls: 'bg-blue-50 text-blue-700 ring-blue-200'     },
  misto:    { label: 'Misto',    cls: 'bg-gray-50 text-gray-600 ring-gray-200'     },
}

const ORIGEM_CHIP: Record<string, { label: string; cls: string }> = {
  manual:    { label: 'Manual',   cls: 'bg-slate-100 text-slate-600' },
  cobertura: { label: 'Cobertura', cls: 'bg-indigo-50 text-indigo-600' },
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function Badge({ status }: { status: string }) {
  const b = STATUS_BADGE[status] ?? STATUS_BADGE.pendente
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', b.cls)}>
      {b.label}
    </span>
  )
}

function RemoverBtn({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <button
      onClick={() => start(() => removerDia(id))}
      disabled={pending}
      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
    >
      {pending ? '...' : 'Remover'}
    </button>
  )
}

function MarcarEnviadoBtn({ grupo, mes, ano }: { grupo: InsalubridadeGrupo; mes: number; ano: number }) {
  const [pending, start] = useTransition()
  const temPendente = grupo.registros.some(r => r.status === 'pendente')
  if (!temPendente) return null
  return (
    <button
      onClick={() => start(() => marcarEnviado(grupo.funcionario_id, mes, ano))}
      disabled={pending}
      className="flex h-7 items-center rounded-md border border-green-200 bg-green-50 px-2.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
    >
      {pending ? '...' : 'Enviado'}
    </button>
  )
}

function PDFBtn({ grupo, mes, ano }: { grupo: InsalubridadeGrupo; mes: number; ano: number }) {
  const [loading, setLoading] = useState(false)
  return (
    <button
      onClick={async () => {
        setLoading(true)
        try { await downloadDeclaracaoPDF(grupo, mes, ano) }
        finally { setLoading(false) }
      }}
      disabled={loading}
      className="flex h-7 items-center rounded-md bg-amber-500 px-2.5 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
    >
      {loading ? '...' : 'PDF'}
    </button>
  )
}

interface Props {
  grupos: InsalubridadeGrupo[]
  mes: number
  ano: number
  funcionariosOpt: FuncOpt[]
  postos: { id: string; nome: string; secretaria: string | null }[]
}

export function InsalubridadeTable({ grupos, mes, ano, funcionariosOpt, postos }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showModal, setShowModal] = useState(false)

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <>
      {/* Action buttons row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {grupos.length} funcionário{grupos.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="flex h-9 items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-amber-400"
          >
            + Nova Declaração
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {grupos.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">
            Nenhum registro de insalubridade encontrado para este mês.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {grupos.map(grupo => {
              const isOpen = expanded.has(grupo.funcionario_id)
              return (
                <div key={grupo.funcionario_id}>
                  {/* Group header row */}
                  <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50/60">
                    <button
                      onClick={() => toggle(grupo.funcionario_id)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100"
                    >
                      {isOpen
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />
                      }
                    </button>

                    <div className="min-w-0 flex-1 grid grid-cols-[2fr_1.5fr_1fr_1fr_0.7fr_1fr_1fr] gap-2 items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{grupo.funcionario_nome}</p>
                        {grupo.funcao && <p className="truncate text-xs text-gray-400">{grupo.funcao}</p>}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-gray-700">{grupo.posto_nome ?? '—'}</p>
                        <p className="truncate text-xs text-gray-400">{grupo.secretaria ?? '—'}</p>
                      </div>
                      <p className="text-sm text-gray-600 truncate">{grupo.supervisor_nome ?? '—'}</p>
                      <p className="text-sm font-bold text-gray-900">{grupo.total_dias} dia{grupo.total_dias !== 1 ? 's' : ''}</p>
                      <p className="text-sm text-gray-600">40%</p>
                      <Badge status={grupo.status} />
                      <div className="flex flex-wrap gap-1">
                        {grupo.origens.map(o => {
                          const chip = ORIGEM_CHIP[o]
                          return (
                            <span key={o} className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', chip.cls)}>
                              {chip.label}
                            </span>
                          )
                        })}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <PDFBtn grupo={grupo} mes={mes} ano={ano} />
                      <MarcarEnviadoBtn grupo={grupo} mes={mes} ano={ano} />
                    </div>
                  </div>

                  {/* Expanded: days detail */}
                  {isOpen && (
                    <div className="border-t border-gray-50 bg-gray-50/50 px-12 py-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left">
                            {['Data', 'Agente Ausente', 'Origem', 'Observação', ''].map(h => (
                              <th key={h} className="pb-2 pr-4 font-semibold uppercase tracking-widest text-gray-400">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {grupo.registros.map((r: InsalubridadeCobertura) => {
                            const chip = ORIGEM_CHIP[r.origem]
                            return (
                              <tr key={r.id} className="text-gray-600">
                                <td className="py-1.5 pr-4 font-medium text-gray-800">{fmt(r.data_cobertura)}</td>
                                <td className="py-1.5 pr-4">{r.agente_ausente_nome ?? '—'}</td>
                                <td className="py-1.5 pr-4">
                                  <span className={cn('inline-flex rounded-full px-2 py-0.5 font-medium', chip.cls)}>
                                    {chip.label}
                                  </span>
                                </td>
                                <td className="py-1.5 pr-4">{r.observacao ?? '—'}</td>
                                <td className="py-1.5">
                                  {r.origem === 'manual' && <RemoverBtn id={r.id} />}
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
            })}
          </div>
        )}
      </div>

      <ModalNovaInsalubridade
        open={showModal}
        onClose={() => setShowModal(false)}
        funcionariosOpt={funcionariosOpt}
        postos={postos}
        mesAtual={mes}
        anoAtual={ano}
      />
    </>
  )
}
