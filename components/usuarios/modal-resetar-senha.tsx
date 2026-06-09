'use client'

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { resetarSenha } from '@/app/(admin)/usuarios/actions'

interface Props {
  perfilId: string | null
  open: boolean
  onClose: () => void
}

export function ModalResetarSenha({ perfilId, open, onClose }: Props) {
  const [pending, setPending] = useState(false)
  const [erro, setErro]       = useState<string | null>(null)
  const [ok, setOk]           = useState(false)

  function handleClose() {
    setErro(null)
    setOk(false)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!perfilId) return
    setErro(null)
    const form = e.currentTarget
    const data = new FormData(form)
    data.set('perfil_id', perfilId)

    const senha    = data.get('senha') as string
    const confirma = data.get('confirma') as string
    if (senha !== confirma) {
      setErro('As senhas não coincidem.')
      return
    }

    setPending(true)
    try {
      const result = await resetarSenha(data)
      if (!result.success) { setErro(result.error); return }
      setOk(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-4 text-lg font-semibold">Redefinir Senha</Dialog.Title>

          {ok ? (
            <div className="space-y-4">
              <p className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                Senha redefinida com sucesso.
              </p>
              <div className="flex justify-end">
                <button
                  onClick={handleClose}
                  className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Fechar
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                  Nova Senha
                </label>
                <input
                  type="password"
                  name="senha"
                  required
                  minLength={8}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                  Confirmar Senha
                </label>
                <input
                  type="password"
                  name="confirma"
                  required
                  minLength={8}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>

              {erro && (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {erro}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {pending ? 'Salvando...' : 'Redefinir'}
                </button>
              </div>
            </form>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
