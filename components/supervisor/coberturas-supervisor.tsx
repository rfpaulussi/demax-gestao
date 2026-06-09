'use client'

import { useState, useEffect, useRef } from 'react'
import { CalendarClock, ArrowRight } from 'lucide-react'
import { Dialog } from '@base-ui/react/dialog'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { encerrarCobertura, registrarCobertura } from '@/app/supervisor/coberturas/actions'

// ─── types ────────────────────────────────────────────────────────────────────

export interface CoberturaSupRow {
  id: string
  funcionario_nome: string
  posto_destino_nome: string
  posto_origem_nome: string | null
  data_inicio: string
  data_prev_retorno: string | null
  urgencia: string
  status: string
}

// Keep legacy alias
export type Cobertura = CoberturaSupRow

interface PostoOption     { id: string; nome: string }
interface FuncOption      { id: string; nome: string }

// ─── urgency helpers ──────────────────────────────────────────────────────────

type UrgKey = 'red' | 'orange' | 'purple' | 'gray'

function calcUrg(dataPrevRetorno: string | null): UrgKey {
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
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR')
}

// ─── shared style tokens ──────────────────────────────────────────────────────

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500'
const inputClass =
  'w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600'

// ─── modal encerrar ───────────────────────────────────────────────────────────

function ModalEncerrar({
  cobertura,
  onClose,
}: {
  cobertura: CoberturaSupRow
  onClose: () => void
}) {
  const [pending, setPending] = useState(false)
  const [erro, setErro]       = useState<string | null>(null)

  async function handleConfirmar() {
    setErro(null)
    setPending(true)
    try {
      const result = await encerrarCobertura(cobertura.id)
      if (!result.success) { setErro(result.error); return }
      onClose()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog.Root open onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-4 text-lg font-semibold">Encerrar Cobertura</Dialog.Title>

          <div className="mb-4 space-y-2 text-sm text-gray-600">
            <p><span className={labelClass}>Funcionário </span>{cobertura.funcionario_nome}</p>
            <p><span className={labelClass}>Posto Destino </span>{cobertura.posto_destino_nome}</p>
            <p><span className={labelClass}>Posto Origem </span>{cobertura.posto_origem_nome ?? '—'}</p>
            <p><span className={labelClass}>Início </span>{fmt(cobertura.data_inicio)}</p>
            <p><span className={labelClass}>Ret. Previsto </span>{fmt(cobertura.data_prev_retorno)}</p>
          </div>

          {erro && (
            <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={pending}
              className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? 'Encerrando...' : 'Confirmar Encerramento'}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── modal nova cobertura (supervisor) ───────────────────────────────────────

function ModalNovaCoberturaSupervisor({
  postoIds,
  onClose,
}: {
  postoIds: string[]
  onClose: () => void
}) {
  const [busca, setBusca]                   = useState('')
  const [resultados, setResultados]         = useState<FuncOption[]>([])
  const [substituto, setSubstituto]         = useState<FuncOption | null>(null)
  const [postos, setPostos]                 = useState<PostoOption[]>([])
  const [postoId, setPostoId]               = useState('')
  const [motivo, setMotivo]                 = useState('')
  const [apenasUmDia, setApenasUmDia]       = useState(false)
  const [dataInicio, setDataInicio]         = useState('')
  const [dataFim, setDataFim]               = useState('')
  const [pending, setPending]               = useState(false)
  const [erro, setErro]                     = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load postos on mount
  useEffect(() => {
    if (postoIds.length === 0) return
    const supabase = createClient()
    supabase.from('postos').select('id, nome').in('id', postoIds).order('nome')
      .then(({ data }) => setPostos(data ?? []))
  }, [postoIds])

  // Typeahead search
  useEffect(() => {
    if (busca.trim().length < 2) { setResultados([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('funcionarios')
        .select('id, nome')
        .eq('status', 'ativo')
        .ilike('nome', `%${busca.trim()}%`)
        .limit(8)
      setResultados(data ?? [])
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [busca])

  function handleClose() {
    setBusca(''); setResultados([]); setSubstituto(null)
    setPostoId(''); setMotivo(''); setApenasUmDia(false)
    setDataInicio(''); setDataFim(''); setErro(null)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!substituto || !postoId) return
    setErro(null)
    const fd = new FormData()
    fd.set('substituto_id', substituto.id)
    fd.set('posto_destino_id', postoId)
    fd.set('motivo', motivo)
    fd.set('data_inicio', dataInicio)
    fd.set('data_fim', apenasUmDia ? dataInicio : dataFim)
    setPending(true)
    try {
      const result = await registrarCobertura(fd)
      if (!result.success) { setErro(result.error); return }
      handleClose()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog.Root open onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="mb-4 text-lg font-semibold">Nova Cobertura</Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Substituto */}
            {!substituto ? (
              <div>
                <label className={labelClass}>Substituto</label>
                <input
                  type="text"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Digite o nome..."
                  className={inputClass}
                />
                {resultados.length > 0 && (
                  <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                    {resultados.map(f => (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => { setSubstituto(f); setBusca(''); setResultados([]) }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          {f.nome}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div>
                <label className={labelClass}>Substituto</label>
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-sm font-medium">{substituto.nome}</p>
                  <button
                    type="button"
                    onClick={() => setSubstituto(null)}
                    className="text-xs text-slate-600 hover:underline"
                  >
                    Trocar
                  </button>
                </div>
              </div>
            )}

            {/* Posto destino */}
            <div>
              <label className={labelClass}>Posto Destino</label>
              <select
                value={postoId}
                onChange={e => setPostoId(e.target.value)}
                required
                className={inputClass}
              >
                <option value="">Selecione...</option>
                {postos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>

            {/* Motivo */}
            <div>
              <label className={labelClass}>Motivo</label>
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                rows={2}
                className={inputClass}
              />
            </div>

            {/* Apenas um dia */}
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={apenasUmDia}
                onChange={e => setApenasUmDia(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Apenas um dia
            </label>

            {/* Datas */}
            <div className={cn('grid gap-3', apenasUmDia ? 'grid-cols-1' : 'grid-cols-2')}>
              <div>
                <label className={labelClass}>Data Início</label>
                <input
                  type="date"
                  required
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  className={inputClass}
                />
              </div>
              {!apenasUmDia && (
                <div>
                  <label className={labelClass}>Data Fim</label>
                  <input
                    type="date"
                    required
                    value={dataFim}
                    onChange={e => setDataFim(e.target.value)}
                    className={inputClass}
                  />
                </div>
              )}
            </div>

            {erro && (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {erro}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={pending}
                className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending || !substituto || !postoId}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {pending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export function CoberturasSupervisor({
  coberturas,
  postoIds,
}: {
  coberturas: CoberturaSupRow[]
  postoIds: string[]
}) {
  const [encerrando, setEncerrando]   = useState<CoberturaSupRow | null>(null)
  const [novaOpen, setNovaOpen]       = useState(false)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {coberturas.length} cobertura{coberturas.length !== 1 ? 's' : ''} ativa{coberturas.length !== 1 ? 's' : ''}
        </p>
        <button
          type="button"
          onClick={() => setNovaOpen(true)}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
        >
          + Nova Cobertura
        </button>
      </div>

      {/* Cards */}
      {coberturas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white py-16 shadow-sm">
          <CalendarClock className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-400">Nenhuma cobertura ativa.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {coberturas.map(c => {
            const urg = calcUrg(c.data_prev_retorno)
            const cfg = URG[urg]
            return (
              <div
                key={c.id}
                className={cn(
                  'flex flex-col rounded-xl border border-gray-100 border-t-4 bg-white p-5 shadow-sm',
                  cfg.border,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-tight text-gray-900">{c.funcionario_nome}</p>
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

                <p className="mt-2 text-sm font-medium text-gray-700">{c.posto_destino_nome}</p>

                {c.posto_origem_nome && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    de {c.posto_origem_nome}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-400">
                  <span>
                    Início: <span className="font-medium text-gray-600">{fmt(c.data_inicio)}</span>
                  </span>
                  {c.data_prev_retorno && (
                    <span>
                      Retorno: <span className="font-medium text-gray-600">{fmt(c.data_prev_retorno)}</span>
                    </span>
                  )}
                </div>

                <div className="mt-auto border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setEncerrando(c)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 transition-colors"
                  >
                    Encerrar Cobertura
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {encerrando && (
        <ModalEncerrar cobertura={encerrando} onClose={() => setEncerrando(null)} />
      )}

      {novaOpen && (
        <ModalNovaCoberturaSupervisor postoIds={postoIds} onClose={() => setNovaOpen(false)} />
      )}
    </div>
  )
}
