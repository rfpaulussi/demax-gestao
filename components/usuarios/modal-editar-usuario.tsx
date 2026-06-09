'use client'

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { atualizarRole } from '@/app/(admin)/usuarios/actions'
interface Perfil {
  id: string
  nome: string | null
  email: string | null
  role: string | null
}

interface Props {
  perfil: Perfil | null
  open: boolean
  onClose: () => void
}

export function ModalEditarUsuario({ perfil, open, onClose }: Props) {
  const [pending, setPending] = useState(false)
  const [erro, setErro]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!perfil) return
    setErro(null)
    const form = e.currentTarget
    const data = new FormData(form)
    data.set('perfil_id', perfil.id)
    setPending(true)
    try {
      const result = await atualizarRole(data)
      if (!result.success) { setErro(result.error); return }
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
          <Dialog.Title className="mb-4 text-lg font-semibold">Editar Usuário</Dialog.Title>

          <form key={perfil?.id} onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                Nome
              </label>
              <input
                type="text"
                readOnly
                value={perfil?.nome ?? ''}
                className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                Email
              </label>
              <input
                type="text"
                readOnly
                value={perfil?.email ?? ''}
                className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                Perfil
              </label>
              <select
                name="role"
                required
                defaultValue={perfil?.role ?? ''}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600"
              >
                <option value="">Selecione...</option>
                <option value="admin">Administrador</option>
                <option value="coordenador">Coordenador</option>
                <option value="supervisor">Supervisor</option>
                <option value="viewer">Visualizador</option>
              </select>
            </div>

            {erro && (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {erro}
              </p>
            )}

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
                {pending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
