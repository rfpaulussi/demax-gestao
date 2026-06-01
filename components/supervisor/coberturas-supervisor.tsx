'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { createClient } from '@/lib/supabase/client'
import { encerrarCobertura, registrarCobertura } from '@/app/supervisor/coberturas/actions'

export interface Cobertura {
  id: string
  funcionario_nome: string
  posto_destino_nome: string
  posto_origem_nome: string | null
  data_inicio: string
  data_prev_retorno: string | null
  urgencia: string
  status: string
}

export type CoberturaSupRow = Cobertura

interface Props {
  coberturas: Cobertura[]
  postoIds: string[]
}

interface PostoOption {
  id: string
  nome: string
}

interface FuncionarioOption {
  id: string
  nome: string
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function getBorderColor(urgencia: string, dataPrevRetorno: string | null) {
  if (!dataPrevRetorno) return 'border-gray-300'
  switch (urgencia) {
    case 'alta': return 'border-red-500'
    case 'media': return 'border-orange-400'
    case 'baixa': return 'border-purple-500'
    default: return 'border-gray-300'
  }
}

function getUrgenciaBadge(urgencia: string, dataPrevRetorno: string | null) {
  if (!dataPrevRetorno) return 'bg-gray-100 text-gray-500'
  switch (urgencia) {
    case 'alta': return 'bg-red-100 text-red-700'
    case 'media': return 'bg-orange-100 text-orange-700'
    case 'baixa': return 'bg-purple-100 text-purple-700'
    default: return 'bg-gray-100 text-gray-500'
  }
}

function getUrgenciaLabel(urgencia: string, dataPrevRetorno: string | null) {
  if (!dataPrevRetorno) return 'SEM DATA'
  return urgencia.toUpperCase()
}

export function CoberturasSupervisor({ coberturas, postoIds }: Props) {
  const [encerrarTarget, setEncerrarTarget] = useState<Cobertura | null>(null)
  const [pendingEncerrar, setPendingEncerrar] = useState(false)

  const [novaOpen, setNovaOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const [resultadosBusca, setResultadosBusca] = useState<FuncionarioOption[]>([])
  const [substituto, setSubstituto] = useState<FuncionarioOption | null>(null)
  const [postos, setPostos] = useState<PostoOption[]>([])
  const [postoId, setPostoId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [apenasUmDia, setApenasUmDia] = useState(false)
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [pendingNova, setPendingNova] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!novaOpen || postoIds.length === 0) return
    const supabase = createClient()
    supabase
      .from('postos')
      .select('id, nome')
      .in('id', postoIds)
      .order('nome')
      .then(({ data }) => setPostos(data ?? []))
  }, [novaOpen, postoIds])

  useEffect(() => {
    if (!novaOpen) return
    if (busca.trim().length < 2) { setResultadosBusca([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('funcionarios')
        .select('id, nome')
        .eq('status', 'ativo')
        .ilike('nome', `%${busca.trim()}%`)
        .limit(8)
      setResultadosBusca(data ?? [])
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [busca, novaOpen])

  async function handleEncerrar() {
    if (!encerrarTarget) return
    setPendingEncerrar(true)
    try {
      await encerrarCobertura(encerrarTarget.id)
      setEncerrarTarget(null)
    } finally {
      setPendingEncerrar(false)
    }
  }

  function handleFecharNova() {
    setBusca(''); setResultadosBusca([]); setSubstituto(null)
    setPostoId(''); setMotivo(''); setApenasUmDia(false)
    setDataInicio(''); setDataFim('')
    setNovaOpen(false)
  }

  async function handleSubmitNova(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!substituto || !postoId) return
    const data = new FormData()
    data.set('substituto_id', substituto.id)
    data.set('posto_destino_id', postoId)
    data.set('motivo', motivo)
    data.set('data_inicio', dataInicio)
    data.set('data_fim', apenasUmDia ? dataInicio : dataFim)
    setPendingNova(true)
    try {
      await registrarCobertura(data)
      handleFecharNova()
    } finally {
      setPendingNova(false)
    }
  }

  return (
    <div className="bg-gray-50">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-700">Coberturas Ativas</h2>
        <button
          type="button"
          onClick={() => setNovaOpen(true)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Nova Cobertura
        </button>
      </div>

      {coberturas.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">Nenhuma cobertura ativa.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {coberturas.map((c) => (
            <div
              key={c.id}
              className={`rounded-lg border-t-4 bg-white shadow-sm ${getBorderColor(c.urgencia, c.data_prev_retorno)}`}
            >
              <div className="flex items-start justify-between p-4 pb-2">
                <p className="font-semibold text-gray-800">{c.funcionario_nome}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getUrgenciaBadge(c.urgencia, c.data_prev_retorno)}`}>
                  {getUrgenciaLabel(c.urgencia, c.data_prev_retorno)}
                </span>
              </div>

              <div className="space-y-1 px-4 pb-3 pt-1 text-xs text-gray-600">
                <p>
                  <span className="font-semibold uppercase tracking-widest text-gray-400">Destino </span>
                  {c.posto_destino_nome}
                </p>
                <p>
                  <span className="font-semibold uppercase tracking-widest text-gray-400">Origem </span>
                  {c.posto_origem_nome ?? '—'}
                </p>
                <p>
                  <span className="font-semibold uppercase tracking-widest text-gray-400">Início </span>
                  {formatDate(c.data_inicio)}
                </p>
                <p>
                  <span className="font-semibold uppercase tracking-widest text-gray-400">Ret. Previsto </span>
                  {formatDate(c.data_prev_retorno)}
                </p>
              </div>

              <div className="border-t border-gray-100 px-4 py-2">
                <button
                  type="button"
                  onClick={() => setEncerrarTarget(c)}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Encerrar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal encerrar */}
      <Dialog.Root open={encerrarTarget !== null} onOpenChange={(isOpen) => { if (!isOpen) setEncerrarTarget(null) }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
            <Dialog.Title className="mb-4 text-lg font-semibold">Encerrar Cobertura</Dialog.Title>

            <div className="mb-4 space-y-2 text-sm text-gray-600">
              <p><span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Funcionário </span>{encerrarTarget?.funcionario_nome}</p>
              <p><span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Posto Destino </span>{encerrarTarget?.posto_destino_nome}</p>
              <p><span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Posto Origem </span>{encerrarTarget?.posto_origem_nome ?? '—'}</p>
              <p><span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Início </span>{formatDate(encerrarTarget?.data_inicio ?? null)}</p>
              <p><span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Ret. Previsto </span>{formatDate(encerrarTarget?.data_prev_retorno ?? null)}</p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEncerrarTarget(null)}
                className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEncerrar}
                disabled={pendingEncerrar}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pendingEncerrar ? 'Encerrando...' : 'Confirmar Encerramento'}
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal nova cobertura */}
      <Dialog.Root open={novaOpen} onOpenChange={(isOpen) => { if (!isOpen) handleFecharNova() }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="mb-4 text-lg font-semibold">Nova Cobertura</Dialog.Title>

            <form onSubmit={handleSubmitNova} className="space-y-4">
              {!substituto ? (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                    Substituto
                  </label>
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Digite o nome..."
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  {resultadosBusca.length > 0 && (
                    <ul className="mt-1 max-h-40 overflow-y-auto rounded border border-gray-200 bg-white shadow">
                      {resultadosBusca.map((f) => (
                        <li key={f.id}>
                          <button
                            type="button"
                            onClick={() => { setSubstituto(f); setBusca(''); setResultadosBusca([]) }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                          >
                            <span className="font-medium">{f.nome}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                    Substituto
                  </label>
                  <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{substituto.nome}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSubstituto(null)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Trocar
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                  Posto Destino
                </label>
                <select
                  value={postoId}
                  onChange={(e) => setPostoId(e.target.value)}
                  required
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">Selecione...</option>
                  {postos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                  Motivo
                </label>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={2}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sup-apenas-um-dia"
                  checked={apenasUmDia}
                  onChange={(e) => setApenasUmDia(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <label htmlFor="sup-apenas-um-dia" className="text-sm text-gray-600">Apenas um dia</label>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                  Data Início
                </label>
                <input
                  type="date"
                  required
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {!apenasUmDia && (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                    Data Fim
                  </label>
                  <input
                    type="date"
                    required
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleFecharNova}
                  className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pendingNova || !substituto || !postoId}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {pendingNova ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
