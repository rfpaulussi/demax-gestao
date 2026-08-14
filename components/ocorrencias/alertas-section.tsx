'use client'

import { useState, useTransition } from 'react'
import type { AlertaRow } from '@/app/(admin)/ocorrencias/actions'
import { criarAlerta, resolverAlerta } from '@/app/(admin)/ocorrencias/actions'

const inputClass =
  'h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-sm text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

export function AlertasSection({
  alertasIniciais,
  canWrite,
}: {
  alertasIniciais: AlertaRow[]
  canWrite: boolean
}) {
  const [alertas, setAlertas]           = useState(alertasIniciais)
  const [aberto, setAberto]             = useState(false)
  const [modalOpen, setModalOpen]       = useState(false)
  const [titulo, setTitulo]             = useState('')
  const [descricao, setDescricao]       = useState('')
  const [lembrete, setLembrete]         = useState('')
  const [erro, setErro]                 = useState<string | null>(null)
  const [isPending, startTransition]    = useTransition()

  function handleCriar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    startTransition(async () => {
      const result = await criarAlerta(titulo, descricao, lembrete || null)
      if (result.success) {
        setModalOpen(false)
        setTitulo(''); setDescricao(''); setLembrete('')
        // recarrega a lista via reload simples da rota (server action já revalida o path)
        window.location.reload()
      } else {
        setErro(result.error)
      }
    })
  }

  function handleResolver(id: string) {
    startTransition(async () => {
      const result = await resolverAlerta(id)
      if (result.success) setAlertas(prev => prev.filter(a => a.id !== id))
      else alert(result.error)
    })
  }

  return (
    <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setAberto(o => !o)}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-purple-700"
        >
          🔔 Meus Alertas {alertas.length > 0 && `(${alertas.length})`}
          <span className="text-purple-400">{aberto ? '▲' : '▼'}</span>
        </button>
        {canWrite && (
          <button
            type="button"
            onClick={() => { setErro(null); setModalOpen(true) }}
            className="h-8 rounded-lg border border-purple-200 bg-white px-3 text-xs font-semibold uppercase tracking-widest text-purple-700 hover:bg-purple-100"
          >
            Novo Alerta
          </button>
        )}
      </div>

      {aberto && (
        <div className="mt-3 space-y-1.5">
          {alertas.length === 0 ? (
            <p className="text-xs text-purple-400">Nenhum alerta aberto.</p>
          ) : (
            alertas.map(a => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs shadow-sm">
                <div>
                  <p className="font-medium text-gray-900">{a.titulo ?? a.descricao}</p>
                  <p className="text-gray-400">
                    {a.supervisor_nome ?? '—'}
                    {a.data_lembrete && ` · lembrete: ${new Date(a.data_lembrete + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                  </p>
                </div>
                <button
                  disabled={isPending}
                  onClick={() => handleResolver(a.id)}
                  className="rounded-lg bg-purple-100 px-3 py-1 font-semibold text-purple-700 hover:bg-purple-200 disabled:opacity-50"
                >
                  Resolver
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-900">🔔 Novo Alerta</h2>
              <button onClick={() => setModalOpen(false)} className="text-lg leading-none text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleCriar} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Título</label>
                <input type="text" required value={titulo} onChange={e => setTitulo(e.target.value)}
                  placeholder="Título do alerta…" className={inputClass} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Descrição</label>
                <textarea required value={descricao} onChange={e => setDescricao(e.target.value)} rows={3}
                  placeholder="Descreva o alerta…"
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Data Lembrete <span className="normal-case font-normal text-gray-400">(opcional)</span>
                </label>
                <input type="date" value={lembrete} onChange={e => setLembrete(e.target.value)} className={inputClass} />
              </div>

              {erro && <p className="text-xs text-red-500">{erro}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="h-9 rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending}
                  className="h-9 rounded-lg bg-purple-700 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-purple-800 disabled:opacity-50">
                  {isPending ? 'Salvando…' : 'Criar Alerta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
