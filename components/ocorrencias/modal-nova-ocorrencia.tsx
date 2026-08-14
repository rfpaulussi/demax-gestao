'use client'

import { useTransition } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import type { SupervisorSimples } from '@/app/(admin)/ocorrencias/actions'
import { createOcorrencia } from '@/app/(admin)/ocorrencias/actions'

const inputClass =
  'h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-sm text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

export function ModalNovaOcorrencia({
  open,
  onClose,
  funcionarioId,
  funcionarioNome,
  supervisores,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  funcionarioId: string
  funcionarioNome: string
  supervisores: SupervisorSimples[]
  onCreated: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const today = new Date().toISOString().split('T')[0]

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('funcionario_id', funcionarioId)
    startTransition(async () => {
      const result = await createOcorrencia(fd)
      if (result.success) {
        onCreated()
        onClose()
      } else {
        alert(result.error)
      }
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[61] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
          <Dialog.Title className="mb-1 text-sm font-bold uppercase tracking-widest text-gray-900">
            Nova Ocorrência
          </Dialog.Title>
          <p className="mb-5 text-sm text-gray-400">{funcionarioNome}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Supervisor</label>
              <select name="supervisor_id" className={inputClass}>
                <option value="">Sem supervisor</option>
                {supervisores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Data</label>
                <input type="date" name="data_ocorrencia" defaultValue={today} required className={inputClass} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Gravidade</label>
                <select name="gravidade" required className={inputClass}>
                  <option value="">Selecionar…</option>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Descrição</label>
              <textarea name="descricao" required rows={3} placeholder="Descreva a ocorrência…"
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400" />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="h-9 rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" disabled={isPending}
                className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700 disabled:opacity-50">
                {isPending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
