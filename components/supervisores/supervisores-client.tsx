'use client'

import { useState, useTransition } from 'react'
import { Plus, X, ArrowRightLeft, Users } from 'lucide-react'
import { vincularPosto, desvincularPosto, transferirPostos } from '@/app/(admin)/supervisores/actions'

export type SupervisorComPostos = {
  id: string
  nome: string | null
  email: string | null
  ativo: boolean | null
  postos: { id: string; nome: string; secretaria: string | null }[]
}

export type PostoOpcao = {
  id: string
  nome: string
  secretaria: string | null
}

// ─── Modal adicionar posto ────────────────────────────────────────────────────

function ModalAdicionarPosto({
  supervisorId,
  postosDisponiveis,
  onClose,
}: {
  supervisorId: string
  postosDisponiveis: PostoOpcao[]
  onClose: () => void
}) {
  const [postoId, setPostoId] = useState('')
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function handleSubmit() {
    if (!postoId) return
    setErro(null)
    startTransition(async () => {
      const res = await vincularPosto(supervisorId, postoId)
      if (!res.success) { setErro(res.error ?? 'Erro'); return }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-base font-bold text-gray-900">Adicionar Posto</h3>

        <select
          value={postoId}
          onChange={e => setPostoId(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        >
          <option value="">Selecione o posto...</option>
          {postosDisponiveis.map(p => (
            <option key={p.id} value={p.id}>
              {p.nome}{p.secretaria ? ` — ${p.secretaria}` : ''}
            </option>
          ))}
        </select>

        {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!postoId || pending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {pending ? 'Salvando...' : 'Vincular'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal transferir postos ──────────────────────────────────────────────────

function ModalTransferir({
  supervisorId,
  supervisorNome: fromNome,
  todosSupevisores,
  onClose,
}: {
  supervisorId: string
  supervisorNome: string
  todosSupevisores: { id: string; nome: string | null }[]
  onClose: () => void
}) {
  const [toId, setToId] = useState('')
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const opcoes = todosSupevisores.filter(s => s.id !== supervisorId)

  function handleSubmit() {
    if (!toId) return
    setErro(null)
    startTransition(async () => {
      const res = await transferirPostos(supervisorId, toId)
      if (!res.success) { setErro(res.error ?? 'Erro'); return }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-1 text-base font-bold text-gray-900">Transferir Postos</h3>
        <p className="mb-4 text-sm text-gray-500">
          Todos os postos de <strong>{fromNome}</strong> serão movidos para o supervisor selecionado.
        </p>

        <select
          value={toId}
          onChange={e => setToId(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        >
          <option value="">Selecione o destino...</option>
          {opcoes.map(s => (
            <option key={s.id} value={s.id}>{s.nome ?? s.id}</option>
          ))}
        </select>

        {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!toId || pending}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-40"
          >
            {pending ? 'Transferindo...' : 'Transferir Tudo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Card de supervisor ───────────────────────────────────────────────────────

function SupervisorCard({
  supervisor,
  todosPostos,
  todosSupervisores,
}: {
  supervisor: SupervisorComPostos
  todosPostos: PostoOpcao[]
  todosSupervisores: { id: string; nome: string | null }[]
}) {
  const [modalAdd, setModalAdd]         = useState(false)
  const [modalTransf, setModalTransf]   = useState(false)
  const [removendo, startRemover]       = useTransition()
  const [removendoId, setRemovendoId]   = useState<string | null>(null)

  const postosVinculados = new Set(supervisor.postos.map(p => p.id))
  const postosDisponiveis = todosPostos.filter(p => !postosVinculados.has(p.id))

  function handleRemover(postoId: string) {
    setRemovendoId(postoId)
    startRemover(async () => {
      await desvincularPosto(supervisor.id, postoId)
      setRemovendoId(null)
    })
  }

  return (
    <>
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 p-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-gray-900">{supervisor.nome ?? '—'}</p>
              {supervisor.ativo === false && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-400">
                  Inativo
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">{supervisor.email ?? ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              <Users className="h-3 w-3" />
              {supervisor.postos.length}
            </span>
          </div>
        </div>

        {/* Postos list */}
        <div className="p-4">
          {supervisor.postos.length === 0 ? (
            <p className="py-2 text-center text-xs text-gray-400">Nenhum posto vinculado</p>
          ) : (
            <ul className="space-y-1.5">
              {supervisor.postos.map(p => (
                <li key={p.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.nome}</p>
                    {p.secretaria && <p className="text-xs text-gray-400">{p.secretaria}</p>}
                  </div>
                  <button
                    onClick={() => handleRemover(p.id)}
                    disabled={removendo && removendoId === p.id}
                    title="Desvincular posto"
                    className="ml-2 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 border-t border-gray-100 p-3">
          <button
            onClick={() => setModalAdd(true)}
            disabled={postosDisponiveis.length === 0}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar Posto
          </button>
          {supervisor.postos.length > 0 && (
            <button
              onClick={() => setModalTransf(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Transferir Tudo
            </button>
          )}
        </div>
      </div>

      {modalAdd && (
        <ModalAdicionarPosto
          supervisorId={supervisor.id}
          postosDisponiveis={postosDisponiveis}
          onClose={() => setModalAdd(false)}
        />
      )}
      {modalTransf && (
        <ModalTransferir
          supervisorId={supervisor.id}
          supervisorNome={supervisor.nome ?? supervisor.id}
          todosSupevisores={todosSupervisores}
          onClose={() => setModalTransf(false)}
        />
      )}
    </>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function SupervisoresClient({
  supervisores,
  todosPostos,
}: {
  supervisores: SupervisorComPostos[]
  todosPostos: PostoOpcao[]
}) {
  const totalPostosAtribuidos = supervisores.reduce((acc, s) => acc + s.postos.length, 0)
  const postosAtribuidos = new Set(supervisores.flatMap(s => s.postos.map(p => p.id)))
  const postosSemSupervisor = todosPostos.filter(p => !postosAtribuidos.has(p.id))

  const todosSupervisores = supervisores.map(s => ({ id: s.id, nome: s.nome }))

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-t-4 border-blue-400 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Supervisores</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{supervisores.length}</p>
        </div>
        <div className="rounded-xl border border-t-4 border-green-400 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Postos Atribuídos</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{totalPostosAtribuidos}</p>
        </div>
        <div className={`rounded-xl border border-t-4 ${postosSemSupervisor.length > 0 ? 'border-red-400' : 'border-gray-200'} bg-white p-4 shadow-sm`}>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Sem Supervisor</p>
          <p className={`mt-1 text-3xl font-bold ${postosSemSupervisor.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {postosSemSupervisor.length}
          </p>
          {postosSemSupervisor.length > 0 && (
            <p className="mt-1 text-xs text-red-500">
              {postosSemSupervisor.slice(0, 2).map(p => p.nome).join(', ')}
              {postosSemSupervisor.length > 2 ? ` +${postosSemSupervisor.length - 2}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Grid de cards */}
      {supervisores.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-12 text-center shadow-sm">
          <p className="text-gray-400">Nenhum supervisor cadastrado. Crie usuários com role <strong>supervisor</strong> em <a href="/usuarios" className="underline">Usuários</a>.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {supervisores.map(s => (
            <SupervisorCard
              key={s.id}
              supervisor={s}
              todosPostos={todosPostos}
              todosSupervisores={todosSupervisores}
            />
          ))}
        </div>
      )}
    </div>
  )
}
