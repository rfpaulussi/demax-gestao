'use client'

import { useState } from 'react'
import { Plus, CalendarClock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ModalNovaCobertura } from './modal-nova-cobertura'
import { ModalEncerrarCobertura } from './modal-encerrar-cobertura'

// ─── types ────────────────────────────────────────────────────────────────────

export type CoberturaRow = {
  id: string
  motivo: string | null
  data_inicio: string | null
  data_prev_retorno: string | null
  urgencia: 'baixa' | 'media' | 'alta' | null
  status: 'ativa' | 'encerrada' | null
  funcionarios: { id: string; nome: string; posto_id: string | null } | null
  posto_destino: { id: string; nome: string; secretaria: string | null } | null
  posto_origem:  { id: string; nome: string; secretaria: string | null } | null
}

// ─── urgency helpers ──────────────────────────────────────────────────────────

type UrgKey = 'red' | 'orange' | 'purple' | 'gray'

function calcUrgencia(dataPrevRetorno: string | null): UrgKey {
  if (!dataPrevRetorno) return 'gray'
  const hoje = new Date()
  const hojeDate = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const [y, m, d] = dataPrevRetorno.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const diff = Math.ceil((dt.getTime() - hojeDate.getTime()) / 86_400_000)
  if (diff <= 1) return 'red'
  if (diff <= 3) return 'orange'
  return 'purple'
}

const URG: Record<UrgKey, { border: string; badge: string; dot: string; label: string }> = {
  red:    { border: 'border-t-red-500',    badge: 'bg-red-50 text-red-700 ring-red-200',          dot: 'bg-red-500',    label: 'Urgente'  },
  orange: { border: 'border-t-orange-500', badge: 'bg-orange-50 text-orange-700 ring-orange-200', dot: 'bg-orange-500', label: 'Atenção'  },
  purple: { border: 'border-t-purple-500', badge: 'bg-purple-50 text-purple-700 ring-purple-200', dot: 'bg-purple-500', label: 'Normal'   },
  gray:   { border: 'border-t-gray-300',   badge: 'bg-gray-100 text-gray-500 ring-gray-200',      dot: 'bg-gray-400',   label: 'Sem data' },
}

function fmt(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ─── component ────────────────────────────────────────────────────────────────

export function CoberturasList({ coberturas }: { coberturas: CoberturaRow[] }) {
  const [novaOpen, setNovaOpen] = useState(false)
  const [encerrando, setEncerrando] = useState<CoberturaRow | null>(null)

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {coberturas.length} cobertura{coberturas.length !== 1 ? 's' : ''} ativa{coberturas.length !== 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={() => setNovaOpen(true)}>
          <Plus className="h-4 w-4" />
          Nova Cobertura
        </Button>
      </div>

      {/* Empty state */}
      {coberturas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white py-16 shadow-sm">
          <CalendarClock className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-400">Nenhuma cobertura ativa no momento.</p>
        </div>
      ) : (
        /* Cards grid */
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {coberturas.map(c => {
            const urg = calcUrgencia(c.data_prev_retorno)
            const cfg = URG[urg]
            return (
              <div
                key={c.id}
                className={cn(
                  'flex flex-col rounded-xl border border-gray-100 border-t-4 bg-white p-5 shadow-sm',
                  cfg.border,
                )}
              >
                {/* Substituto + badge */}
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-tight text-gray-900">
                    {c.funcionarios?.nome ?? '—'}
                  </p>
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                      cfg.badge,
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                    {cfg.label}
                  </span>
                </div>

                {/* Posto destino */}
                <p className="mt-2 text-sm font-medium text-gray-700">
                  {c.posto_destino?.nome ?? '—'}
                </p>
                {c.posto_destino?.secretaria && (
                  <p className="text-xs text-gray-400">{c.posto_destino.secretaria}</p>
                )}

                {/* Origem */}
                {c.posto_origem && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    de {c.posto_origem.nome}
                  </p>
                )}

                {/* Motivo */}
                {c.motivo && (
                  <p className="mt-2 line-clamp-2 text-xs text-gray-500">{c.motivo}</p>
                )}

                {/* Datas */}
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-400">
                  <span>
                    Início:{' '}
                    <span className="font-medium text-gray-600">
                      {c.data_inicio ? fmt(c.data_inicio) : '—'}
                    </span>
                  </span>
                  {c.data_prev_retorno && (
                    <span>
                      Retorno:{' '}
                      <span className="font-medium text-gray-600">
                        {fmt(c.data_prev_retorno)}
                      </span>
                    </span>
                  )}
                </div>

                {/* Action */}
                <div className="mt-auto pt-4 border-t border-gray-50 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setEncerrando(c)}
                  >
                    Encerrar Cobertura
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      <ModalNovaCobertura open={novaOpen} onClose={() => setNovaOpen(false)} />

      {encerrando && (
        <ModalEncerrarCobertura
          open
          onClose={() => setEncerrando(null)}
          cobertura={encerrando}
        />
      )}
    </>
  )
}
