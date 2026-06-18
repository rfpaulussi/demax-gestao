'use client'

import { useState, useEffect } from 'react'
import { Plus, CalendarClock, ArrowRight, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ModalNovaCobertura } from './modal-nova-cobertura'
import { ModalEncerrarCobertura } from './modal-encerrar-cobertura'

// ─── types ────────────────────────────────────────────────────────────────────

export type CoberturaRow = {
  id: string
  motivo: string | null
  tipo_motivo: string | null
  funcionario_ausente_id: string | null
  data_inicio: string | null
  data_prev_retorno: string | null
  data_retorno_real: string | null
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

function fmt(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

// ─── card ─────────────────────────────────────────────────────────────────────

function CoberturaCard({
  c,
  onEncerrar,
  faltaRegistrada,
}: {
  c: CoberturaRow
  onEncerrar?: (c: CoberturaRow) => void
  faltaRegistrada?: boolean | null
}) {
  const urg = calcUrgencia(c.data_prev_retorno)
  const cfg = URG[urg]
  const encerrada = c.status === 'encerrada'

  const isFaltaMotivo    = c.tipo_motivo === 'falta_justificada' || c.tipo_motivo === 'falta_injustificada'
  const isAtestadoMotivo = c.tipo_motivo === 'atestado_medico'
  const showStatusBadge  = !encerrada && (isFaltaMotivo || isAtestadoMotivo) && Boolean(c.funcionario_ausente_id) && faltaRegistrada !== null && faltaRegistrada !== undefined

  const statusBadgeLabel = faltaRegistrada
    ? (isAtestadoMotivo ? '✓ Atestado registrado' : '✓ Falta registrada')
    : (isAtestadoMotivo ? '⚠ Atestado pendente'  : '⚠ Falta pendente')

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-gray-100 border-t-4 bg-white p-5 shadow-sm',
        encerrada ? 'border-t-gray-200 opacity-70' : cfg.border,
      )}
    >
      {/* Substituto + badge */}
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold leading-tight text-gray-900">
          {c.funcionarios?.nome ?? '—'}
        </p>
        {!encerrada && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
              cfg.badge,
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
            {cfg.label}
          </span>
        )}
        {encerrada && (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500 ring-1 ring-inset ring-gray-200">
            Encerrada
          </span>
        )}
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

      {/* Badge falta/atestado registrado */}
      {showStatusBadge && (
        <div className="mt-2">
          <span className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
            faltaRegistrada
              ? 'bg-green-50 text-green-700 ring-green-200'
              : 'bg-amber-50 text-amber-700 ring-amber-200',
          )}>
            {statusBadgeLabel}
          </span>
        </div>
      )}

      {/* Datas */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-400">
        <span>
          Início:{' '}
          <span className="font-medium text-gray-600">{fmt(c.data_inicio)}</span>
        </span>
        {!encerrada && c.data_prev_retorno && (
          <span>
            Retorno:{' '}
            <span className="font-medium text-gray-600">{fmt(c.data_prev_retorno)}</span>
          </span>
        )}
        {encerrada && c.data_retorno_real && (
          <span>
            Encerrada em:{' '}
            <span className="font-medium text-gray-600">{fmt(c.data_retorno_real)}</span>
          </span>
        )}
      </div>

      {onEncerrar && (
        <div className="mt-auto border-t border-gray-100 pt-4">
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => onEncerrar(c)}
          >
            Encerrar Cobertura
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

type UrgFilter = 'all' | UrgKey

const URG_FILTER_LABELS: Record<UrgFilter, string> = {
  all:    'Todas',
  red:    'Urgente',
  orange: 'Atenção',
  purple: 'Normal',
  gray:   'Sem data',
}

export function CoberturasList({
  coberturas,
  historico = [],
  supervisores = [],
  faltasStatus = {},
}: {
  coberturas: CoberturaRow[]
  historico?: CoberturaRow[]
  supervisores?: { id: string; nome: string }[]
  faltasStatus?: Record<string, boolean>
}) {
  const [novaOpen, setNovaOpen]     = useState(false)
  const [encerrando, setEncerrando] = useState<CoberturaRow | null>(null)
  const [urgFilter, setUrgFilter]   = useState<UrgFilter>('all')
  const [historicoOpen, setHistoricoOpen] = useState(false)
  const [toastMsg, setToastMsg]     = useState<string | null>(null)

  useEffect(() => {
    if (!toastMsg) return
    const t = setTimeout(() => setToastMsg(null), 4500)
    return () => clearTimeout(t)
  }, [toastMsg])

  const filtered =
    urgFilter === 'all'
      ? coberturas
      : coberturas.filter(c => calcUrgencia(c.data_prev_retorno) === urgFilter)

  const urgCounts = coberturas.reduce<Record<UrgKey, number>>(
    (acc, c) => {
      const k = calcUrgencia(c.data_prev_retorno)
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    },
    { red: 0, orange: 0, purple: 0, gray: 0 },
  )

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

      {/* Urgência filter pills */}
      {coberturas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(['all', 'red', 'orange', 'purple', 'gray'] as UrgFilter[]).map(key => {
            const count = key === 'all' ? coberturas.length : urgCounts[key]
            if (key !== 'all' && count === 0) return null
            return (
              <button
                key={key}
                type="button"
                onClick={() => setUrgFilter(key)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                  urgFilter === key
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-gray-500 ring-1 ring-gray-200 hover:ring-gray-400',
                )}
              >
                {URG_FILTER_LABELS[key]}
                <span className="ml-1.5 opacity-60">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white py-16 shadow-sm">
          <CalendarClock className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-400">
            {coberturas.length === 0
              ? 'Nenhuma cobertura ativa no momento.'
              : 'Nenhuma cobertura com esse filtro.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(c => (
            <CoberturaCard
              key={c.id}
              c={c}
              onEncerrar={setEncerrando}
              faltaRegistrada={
                (c.tipo_motivo === 'falta_justificada' || c.tipo_motivo === 'falta_injustificada' || c.tipo_motivo === 'atestado_medico') && c.funcionario_ausente_id
                  ? (faltasStatus[c.id] ?? false)
                  : null
              }
            />
          ))}
        </div>
      )}

      {/* Histórico encerradas */}
      {historico.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setHistoricoOpen(v => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-3 shadow-sm hover:bg-gray-50"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Histórico encerradas ({historico.length})
            </p>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-gray-400 transition-transform',
                historicoOpen && 'rotate-180',
              )}
            />
          </button>

          {historicoOpen && (
            <div className="mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {historico.map(c => (
                <CoberturaCard key={c.id} c={c} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <ModalNovaCobertura
        open={novaOpen}
        onClose={() => setNovaOpen(false)}
        supervisores={supervisores}
        onSuccess={msg => { setNovaOpen(false); setToastMsg(msg) }}
      />

      {encerrando && (
        <ModalEncerrarCobertura
          open
          onClose={() => setEncerrando(null)}
          cobertura={encerrando}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border border-green-200 bg-green-50 px-4 py-3 shadow-lg">
          <p className="text-sm font-medium text-green-800">{toastMsg}</p>
        </div>
      )}
    </>
  )
}
