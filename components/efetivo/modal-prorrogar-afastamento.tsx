'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { buscarAfastamentoAberto, prorrogarAfastamento } from '@/app/(admin)/efetivo/actions'
import type { FuncionarioRow } from './funcionarios-table'

interface Props {
  funcionario: FuncionarioRow
  open: boolean
  onClose: () => void
}

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600'
const inputClass = 'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600'

export function ModalProrrogarAfastamento({ funcionario, open, onClose }: Props) {
  const [carregando, setCarregando] = useState(true)
  const [afastamentoId, setAfastamentoId] = useState<string | null>(null)
  const [dataAtual, setDataAtual] = useState<string | null>(null)
  const [novaData, setNovaData] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelado = false
    setCarregando(true)
    setErro(null)
    buscarAfastamentoAberto(funcionario.id).then(res => {
      if (cancelado) return
      if (!res) {
        setAfastamentoId(null)
        setDataAtual(null)
      } else {
        setAfastamentoId(res.id)
        setDataAtual(res.dataFimPrevista)
        setNovaData(res.dataFimPrevista ?? '')
      }
      setCarregando(false)
    }).catch(err => {
      if (cancelado) return
      setErro(err instanceof Error ? err.message : 'Erro ao buscar afastamento')
      setCarregando(false)
    })
    return () => { cancelado = true }
  }, [open, funcionario.id])

  function resetState() {
    setNovaData('')
    setErro(null)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!afastamentoId) return
    setErro(null)
    setPending(true)
    try {
      const res = await prorrogarAfastamento(afastamentoId, novaData)
      if (!res.success) {
        setErro(res.error ?? 'Erro ao prorrogar')
        return
      }
      resetState()
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao prorrogar afastamento')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={isOpen => { if (!isOpen) { resetState(); onClose() } }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-1 text-lg font-semibold">Prorrogar Afastamento</Dialog.Title>
          <p className="mb-4 text-sm text-gray-500">{funcionario.nome}</p>

          {carregando ? (
            <p className="py-6 text-center text-sm text-gray-400">Carregando...</p>
          ) : !afastamentoId ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Nenhum afastamento rastreado pra esse funcionário — não é possível prorrogar por aqui.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Data prevista atual</label>
                <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  {dataAtual ? dataAtual.split('-').reverse().join('/') : 'Não informada'}
                </p>
              </div>
              <div>
                <label className={labelClass}>Nova data prevista de retorno</label>
                <input
                  type="date"
                  required
                  value={novaData}
                  onChange={e => setNovaData(e.target.value)}
                  className={inputClass}
                />
              </div>
              {erro && (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { resetState(); onClose() }}
                  className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {pending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
