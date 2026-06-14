'use client'

import { useState, useTransition, useMemo, useEffect, useRef } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { solicitarAdmissao } from '@/app/(admin)/postos/actions'

type PostoOpt = { id: string; nome: string; secretaria: string | null }
type FuncaoOpt = { id: string; nome: string; postoFiltro: 'apenas_sms' | 'todos' | 'sem_sms' }

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  postos: PostoOpt[]
  funcoes: FuncaoOpt[]
}

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500'
const inputClass =
  'w-full rounded border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600'

export function ModalNovaAdmissao({ open, onClose, onSuccess, postos, funcoes }: Props) {
  const [erro, setErro]         = useState<string | null>(null)
  const [ok, setOk]             = useState(false)
  const [pending, start]        = useTransition()
  const [funcaoId, setFuncaoId] = useState('')
  const [postoId, setPostoId]   = useState('')
  const postoRef                = useRef<HTMLSelectElement>(null)

  const selectedFuncao = funcoes.find(f => f.id === funcaoId) ?? null

  const postosFiltrados = useMemo(() => {
    if (!selectedFuncao) return postos
    switch (selectedFuncao.postoFiltro) {
      case 'apenas_sms': return postos.filter(p => p.secretaria === 'SMS')
      case 'todos':      return postos
      case 'sem_sms':    return postos.filter(p => p.secretaria !== 'SMS')
    }
  }, [postos, selectedFuncao])

  // Reset posto quando ele ficar inválido pela troca de função
  useEffect(() => {
    if (!postoId) return
    const still = postosFiltrados.some(p => p.id === postoId)
    if (!still) {
      setPostoId('')
      if (postoRef.current) postoRef.current.value = ''
    }
  }, [postosFiltrados, postoId])

  function handleClose() {
    if (pending) return
    setErro(null)
    setOk(false)
    setFuncaoId('')
    setPostoId('')
    onClose()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const fd = new FormData(e.currentTarget)
    start(async () => {
      const result = await solicitarAdmissao(fd)
      if (!result.success) { setErro(result.error); return }
      handleClose()
      onSuccess?.()
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={isOpen => { if (!isOpen) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="mb-1 text-lg font-semibold">Solicitar Admissão</Dialog.Title>
          <p className="mb-4 text-sm text-gray-400">
            Pré-cadastro de novo funcionário — aguarda aprovação do administrador.
          </p>

          <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Esta solicitação será enviada para aprovação antes de criar o cadastro.
          </div>

          {ok ? (
            <div className="py-6 text-center">
              <p className="text-2xl">✓</p>
              <p className="mt-2 text-sm font-medium text-gray-700">Solicitação enviada com sucesso!</p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-4 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Fechar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Nome completo</label>
                <input
                  type="text"
                  name="nome"
                  required
                  placeholder="Nome do funcionário..."
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Função</label>
                <select
                  name="funcao_id"
                  required
                  className={inputClass}
                  value={funcaoId}
                  onChange={e => setFuncaoId(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {funcoes.map(f => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Posto</label>
                <select
                  ref={postoRef}
                  name="posto_id"
                  required
                  className={inputClass}
                  value={postoId}
                  onChange={e => setPostoId(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {postosFiltrados.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome}{p.secretaria ? ` — ${p.secretaria}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Data de admissão</label>
                <input type="date" name="data_admissao" required className={inputClass} />
              </div>

              {erro && (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
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
                  disabled={pending}
                  className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {pending ? 'Enviando...' : 'Enviar Solicitação'}
                </button>
              </div>
            </form>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
