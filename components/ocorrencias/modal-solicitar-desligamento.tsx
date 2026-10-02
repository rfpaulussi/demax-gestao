'use client'

import { useState, useTransition } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { solicitarDesligamento } from '@/app/(admin)/efetivo/actions'
import { CamposDesligamento } from '@/components/efetivo/campos-desligamento'

interface Props {
  funcionarioId: string
  funcionarioNome: string
  emExperiencia: boolean
  onClose: () => void
}

/** Pedido de desligamento aberto a partir do dossiê da ocorrência: cai em Aprovações, de onde o comunicado é impresso. */
export function ModalSolicitarDesligamento({ funcionarioId, funcionarioNome, emExperiencia, onClose }: Props) {
  const [pending, start] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('funcionario_id', funcionarioId)
    setErro(null)
    start(async () => {
      const result = await solicitarDesligamento(fd)
      if (!result.success) { setErro(result.error); return }
      setEnviado(true)
    })
  }

  return (
    <Dialog.Root open onOpenChange={(isOpen) => { if (!isOpen && !pending) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[70] max-h-[90vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-1 text-lg font-semibold">Solicitar Desligamento</Dialog.Title>
          <p className="mb-4 text-sm text-gray-400">{funcionarioNome}</p>

          {enviado ? (
            <div className="space-y-4">
              <p className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                Solicitação enviada. Ela já está em Aprovações — de lá você aprova e imprime o comunicado.
              </p>
              <div className="flex justify-end gap-2">
                <a href="/aprovacoes" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                  Ir para Aprovações
                </a>
                <button type="button" onClick={onClose} className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
                  Fechar
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <CamposDesligamento emExperiencia={emExperiencia} />

              {erro && (
                <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{erro}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onClose} disabled={pending} className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
                  Cancelar
                </button>
                <button type="submit" disabled={pending} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                  {pending ? 'Enviando...' : 'Enviar para Aprovação'}
                </button>
              </div>
            </form>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
