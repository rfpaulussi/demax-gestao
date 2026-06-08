'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { registrarFerias } from '@/app/(admin)/ferias/actions'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Funcionario {
  id: string
  nome: string
  registro: string
  posto_nome: string
  secretaria: string
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcDias(inicio: string, fim: string): number {
  if (!inicio || !fim) return 0
  const a = new Date(inicio + 'T00:00:00')
  const b = new Date(fim + 'T00:00:00')
  const diff = Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1
  return diff > 0 ? diff : 0
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function ModalNovaFerias({ open, onClose, onSuccess }: Props) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<Funcionario[]>([])
  const [selecionado, setSelecionado] = useState<Funcionario | null>(null)
  const [showResultados, setShowResultados] = useState(false)
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [observacao, setObservacao] = useState('')
  const [pending, setPending] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const buscaRef = useRef<HTMLInputElement>(null)

  // Foca busca ao abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => buscaRef.current?.focus(), 100)
    }
  }, [open])

  // Busca funcionários com debounce
  useEffect(() => {
    if (!open) return
    if (busca.trim().length < 2) { setResultados([]); setShowResultados(false); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('funcionarios')
        .select(`
          id, nome, registro,
          postos ( nome, secretaria )
        `)
        .eq('status', 'ativo')
        .ilike('nome', `%${busca.trim()}%`)
        .limit(8)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: Funcionario[] = (data ?? []).map((f: any) => ({
        id: f.id,
        nome: f.nome,
        registro: f.registro ?? '—',
        posto_nome: f.postos?.nome ?? '—',
        secretaria: f.postos?.secretaria ?? '—',
      }))
      setResultados(mapped)
      setShowResultados(true)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [busca, open])

  function reset() {
    setBusca('')
    setResultados([])
    setSelecionado(null)
    setShowResultados(false)
    setDataInicio('')
    setDataFim('')
    setObservacao('')
    setErro(null)
    setSucesso(false)
    setPending(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function selecionarFuncionario(f: Funcionario) {
    setSelecionado(f)
    setBusca(f.nome)
    setShowResultados(false)
    setResultados([])
  }

  function limparSelecao() {
    setSelecionado(null)
    setBusca('')
    setResultados([])
    setShowResultados(false)
    setTimeout(() => buscaRef.current?.focus(), 50)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!selecionado) { setErro('Selecione um funcionário.'); return }
    if (!dataInicio) { setErro('Informe a data de início.'); return }
    if (!dataFim) { setErro('Informe a data de fim.'); return }
    if (dataFim < dataInicio) { setErro('Data de fim deve ser após o início.'); return }

    const formData = new FormData()
    formData.set('funcionario_id', selecionado.id)
    formData.set('data_inicio', dataInicio)
    formData.set('data_fim', dataFim)
    if (observacao.trim()) formData.set('observacao', observacao.trim())

    setPending(true)
    try {
      await registrarFerias(formData)
      setSucesso(true)
      setTimeout(() => {
        reset()
        onSuccess?.()
        onClose()
      }, 1200)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setErro(err?.message ?? 'Erro ao registrar férias.')
    } finally {
      setPending(false)
    }
  }

  const dias = calcDias(dataInicio, dataFim)

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Nova Férias</h2>
            <p className="text-xs text-slate-400 mt-0.5">Registrar período de férias</p>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 text-xl font-light leading-none"
          >
            ✕
          </button>
        </div>

        {/* Conteúdo */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Busca de funcionário */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
              Funcionário
            </label>
            <div className="relative">
              <input
                ref={buscaRef}
                type="text"
                value={busca}
                onChange={e => {
                  setBusca(e.target.value)
                  if (selecionado) setSelecionado(null)
                }}
                placeholder="Digite o nome..."
                autoComplete="off"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 pr-8"
              />
              {selecionado && (
                <button
                  type="button"
                  onClick={limparSelecao}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
                >
                  ✕
                </button>
              )}

              {/* Dropdown resultados */}
              {showResultados && resultados.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {resultados.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => selecionarFuncionario(f)}
                      className="w-full text-left px-3 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors"
                    >
                      <div className="text-sm font-medium text-slate-800">{f.nome}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {f.registro} · {f.posto_nome} · {f.secretaria}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {showResultados && resultados.length === 0 && busca.trim().length >= 2 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-3 text-sm text-slate-400">
                  Nenhum funcionário encontrado
                </div>
              )}
            </div>

            {/* Card funcionário selecionado */}
            {selecionado && (
              <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <div>
                  <div className="text-xs font-medium text-slate-700">{selecionado.posto_nome}</div>
                  <div className="text-xs text-slate-400">{selecionado.secretaria} · Reg. {selecionado.registro}</div>
                </div>
              </div>
            )}
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                Início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                Fim
              </label>
              <input
                type="date"
                value={dataFim}
                min={dataInicio || undefined}
                onChange={e => setDataFim(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
          </div>

          {/* Contador de dias */}
          {dias > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              <span className="text-blue-600 font-bold text-lg">{dias}</span>
              <span className="text-sm text-blue-600">
                {dias === 1 ? 'dia de férias' : 'dias de férias'}
              </span>
            </div>
          )}

          {/* Observação */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
              Observação <span className="text-slate-300 font-normal normal-case">(opcional)</span>
            </label>
            <textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              placeholder="Ex: venda de 10 dias, férias fracionadas..."
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
            />
          </div>

          {/* Erro */}
          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
              {erro}
            </div>
          )}

          {/* Sucesso */}
          {sucesso && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700 font-medium">
              ✓ Férias registradas com sucesso!
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={pending}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending || sucesso}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {pending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </>
              ) : 'Registrar Férias'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
