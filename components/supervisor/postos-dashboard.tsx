'use client'

import { useState, useEffect } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { UserPlus } from 'lucide-react'
import { registrarAtestadoSupervisor } from '@/app/supervisor/meu-posto/actions'
import { ModalNovaAdmissao } from './modal-nova-admissao'

interface Funcionario {
  id: string
  nome: string
  status: string
  funcao_nome: string | null
}

export interface PostoData {
  id: string
  nome: string
  secretaria: string
  efetivo_previsto: number
  funcionarios: Funcionario[]
}

type Posto = PostoData

interface Props {
  postos: Posto[]
  funcoes?: { id: string; nome: string }[]
}

interface ModalState {
  funcionarioId: string
  funcionarioNome: string
}

const STATUS_BADGE: Record<string, string> = {
  ativo:    'bg-green-100 text-green-700',
  afastado: 'bg-red-100 text-red-700',
  ferias:   'bg-orange-100 text-orange-700',
}

function PostoCard({ posto }: { posto: Posto }) {
  const efetivo_real = posto.funcionarios.length
  const diff = efetivo_real - posto.efetivo_previsto

  const situacao    = diff === 0 ? 'COMPLETO' : diff < 0 ? 'DÉFICIT' : 'EXCESSO'
  const borderColor = diff === 0 ? 'border-green-500' : diff < 0 ? 'border-red-500' : 'border-indigo-500'
  const badgeColor  = diff === 0 ? 'bg-green-100 text-green-700' : diff < 0 ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'

  const [modal, setModal]     = useState<ModalState | null>(null)
  const [pending, setPending] = useState(false)

  async function handleAtestado(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!modal) return
    const form = e.currentTarget
    const data = new FormData(form)
    data.set('funcionario_id', modal.funcionarioId)
    data.set('posto_id', posto.id)
    setPending(true)
    try {
      await registrarAtestadoSupervisor(data)
      form.reset()
      setModal(null)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <div className={`rounded-lg border-t-4 bg-white shadow-sm ${borderColor}`}>
        <div className="flex items-start justify-between p-4 pb-2">
          <div>
            <h3 className="font-semibold text-gray-800">{posto.nome}</h3>
            <p className="text-xs text-gray-500">{posto.secretaria}</p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeColor}`}>
            {situacao}
          </span>
        </div>

        <div className="border-b border-gray-100 px-4 pb-3 pt-1 text-xs text-gray-600">
          Previsto: <span className="font-medium">{posto.efetivo_previsto}</span>
          {' | '}Em campo: <span className="font-medium">{efetivo_real}</span>
          {' | '}Diferença:{' '}
          <span className={`font-medium ${diff < 0 ? 'text-red-600' : diff > 0 ? 'text-indigo-600' : 'text-green-600'}`}>
            {diff > 0 ? `+${diff}` : diff}
          </span>
        </div>

        <ul className="divide-y divide-gray-50 p-2">
          {posto.funcionarios.map((f) => (
            <li key={f.id} className="flex items-center justify-between rounded px-2 py-2 hover:bg-gray-50">
              <div>
                <p className="text-sm font-medium text-gray-800">{f.nome}</p>
                <p className="text-xs text-gray-500">{f.funcao_nome}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[f.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {f.status}
                </span>
                {f.status === 'ativo' && (
                  <button
                    type="button"
                    onClick={() => setModal({ funcionarioId: f.id, funcionarioNome: f.nome })}
                    className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                  >
                    Atestado
                  </button>
                )}
              </div>
            </li>
          ))}
          {posto.funcionarios.length === 0 && (
            <li className="px-2 py-3 text-center text-xs text-gray-400">Nenhum funcionário alocado</li>
          )}
        </ul>
      </div>

      <Dialog.Root open={modal !== null} onOpenChange={(isOpen) => { if (!isOpen) setModal(null) }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
            <Dialog.Title className="mb-1 text-lg font-semibold">Registrar Atestado</Dialog.Title>
            <p className="mb-4 text-sm text-gray-500">{modal?.funcionarioNome}</p>

            <form onSubmit={handleAtestado} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                  Data Início
                </label>
                <input
                  type="date"
                  name="data_inicio"
                  required
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                  Data Fim
                </label>
                <input
                  type="date"
                  name="data_fim"
                  required
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                  Motivo
                </label>
                <textarea
                  name="motivo"
                  rows={3}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {pending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

export function PostosDashboard({ postos, funcoes = [] }: Props) {
  const [novaAdmissaoOpen, setNovaAdmissaoOpen] = useState(false)
  const [toast, setToast] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(false), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const postosParaModal = postos.map(p => ({
    id: p.id,
    nome: p.nome,
    secretaria: p.secretaria ?? null,
  }))

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {postos.length} posto{postos.length !== 1 ? 's' : ''} sob supervisão
        </p>
        <button
          type="button"
          onClick={() => setNovaAdmissaoOpen(true)}
          disabled={postos.length === 0 || funcoes.length === 0}
          title={postos.length === 0 ? 'Nenhum posto vinculado' : undefined}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Nova Admissão
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-sm">
          <span>✓</span>
          <span>Admissão enviada para aprovação.</span>
        </div>
      )}

      {/* Grid de postos */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {postos.map((posto) => (
          <PostoCard key={posto.id} posto={posto} />
        ))}
        {postos.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-gray-400">
            Nenhum posto encontrado.
          </p>
        )}
      </div>

      <ModalNovaAdmissao
        open={novaAdmissaoOpen}
        onClose={() => setNovaAdmissaoOpen(false)}
        onSuccess={() => setToast(true)}
        postos={postosParaModal}
        funcoes={funcoes}
      />
    </div>
  )
}
