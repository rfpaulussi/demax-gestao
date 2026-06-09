'use client'

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { encerrarCobertura } from '@/app/(admin)/coberturas/actions'
import type { CoberturaRow } from './coberturas-list'

interface Props {
  cobertura: CoberturaRow | null
  open: boolean
  onClose: () => void
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function ModalEncerrarCobertura({ cobertura, open, onClose }: Props) {
  const [pending, setPending] = useState(false)
  const [erro, setErro]       = useState<string | null>(null)

  function handleClose() {
    setErro(null)
    onClose()
  }

  async function handleConfirmar() {
    if (!cobertura) return
    setErro(null)
    setPending(true)
    try {
      const result = await encerrarCobertura(cobertura.id)
      if (!result.success) { setErro(result.error); return }
      handleClose()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-4 text-lg font-semibold">Encerrar Cobertura</Dialog.Title>

          <div className="mb-4 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Funcionário</p>
              <p className="text-sm font-medium">{cobertura?.funcionarios?.nome ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Posto Destino</p>
              <p className="text-sm">{cobertura?.posto_destino?.nome ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Posto Origem</p>
              <p className="text-sm">{cobertura?.posto_origem?.nome ?? '—'}</p>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Data Início</p>
                <p className="text-sm">{formatDate(cobertura?.data_inicio ?? null)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Previsão de Retorno</p>
                <p className="text-sm">{formatDate(cobertura?.data_prev_retorno ?? null)}</p>
              </div>
            </div>
          </div>

          {erro && (
            <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
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
