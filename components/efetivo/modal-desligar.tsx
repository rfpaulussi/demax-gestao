'use client'

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { solicitarDesligamento } from '@/app/(admin)/efetivo/actions'
import type { FuncionarioRow } from './funcionarios-table'

interface Props {
  funcionario: FuncionarioRow
  open: boolean
  onClose: () => void
}

export function ModalDesligar({ funcionario, open, onClose }: Props) {
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    data.set('funcionario_id', funcionario.id)
    setPending(true)
    try {
      await solicitarDesligamento(data)
      form.reset()
      onClose()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-1 text-lg font-semibold">Solicitar Desligamento</Dialog.Title>
          <p className="mb-4 text-sm text-gray-500">{funcionario.nome}</p>

          <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Esta solicitação será enviada para aprovação do administrador antes de ser efetivada.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                Data de Desligamento
              </label>
              <input
                type="date"
                name="data_desligamento"
                required
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                Motivo
              </label>
              <select
                name="motivo"
                required
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600"
              >
                <option value="">Selecione...</option>
                <option value="PESSOAL">PESSOAL</option>
                <option value="RESCISÃO INDIRETA">RESCISÃO INDIRETA</option>
                <option value="ADAPTAÇÃO">ADAPTAÇÃO</option>
                <option value="COMPORTAMENTAL">COMPORTAMENTAL</option>
                <option value="FALTAS EXCESSIVAS">FALTAS EXCESSIVAS</option>
                <option value="ABANDONO">ABANDONO</option>
                <option value="CORTE DE CUSTO">CORTE DE CUSTO</option>
                <option value="DEFICIÊNCIA TÉCNICA">DEFICIÊNCIA TÉCNICA</option>
                <option value="SALÁRIO">SALÁRIO</option>
                <option value="FALECIMENTO">FALECIMENTO</option>
                <option value="JUSTA CAUSA">JUSTA CAUSA</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
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
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
