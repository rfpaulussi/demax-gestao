'use client'

import { useState, useTransition } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { solicitarAfastamento } from '@/app/(admin)/efetivo/actions'
import type { FuncionarioRow } from './funcionarios-table'

interface Props {
  funcionario: FuncionarioRow
  open: boolean
  onClose: () => void
}

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600'
const inputClass = 'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600'

export function ModalAfastar({ funcionario, open, onClose }: Props) {
  const [erro, setErro]  = useState<string | null>(null)
  const [pending, start] = useTransition()

  function handleClose() {
    if (pending) return
    setErro(null)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const fd = new FormData(e.currentTarget)
    fd.set('funcionario_id', funcionario.id)

    start(async () => {
      const result = await solicitarAfastamento(fd)
      if (!result.success) {
        setErro(result.error)
        return
      }
      handleClose()
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-1 text-lg font-semibold">Solicitar Afastamento</Dialog.Title>
          <p className="mb-4 text-sm text-gray-500">{funcionario.nome}</p>

          <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Esta solicitação será enviada para aprovação do administrador antes de ser efetivada.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>Motivo do Afastamento</label>
              <select name="motivo" required className={inputClass}>
                <option value="">Selecione...</option>
                <option value="INSS - Doença">INSS — Doença</option>
                <option value="INSS - Acidente de Trabalho">INSS — Acidente de Trabalho</option>
                <option value="Licença Maternidade">Licença Maternidade</option>
                <option value="Licença Paternidade">Licença Paternidade</option>
                <option value="Afastamento Judicial">Afastamento Judicial</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Data de Início</label>
              <input type="date" name="data_inicio" required className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Data Prevista de Retorno</label>
              <input type="date" name="data_retorno_prevista" className={inputClass} />
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
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
