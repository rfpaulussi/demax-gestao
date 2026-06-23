'use client'

import { useState, useTransition } from 'react'
import { editarFalta } from '@/app/(admin)/faltas/actions'
import { FALTA_TIPO_LABELS, FALTA_TIPOS_MANUAIS } from './faltas-config'
import type { FaltaCompleta, FaltaTipo } from '@/app/(admin)/faltas/actions'

interface Props {
  falta: FaltaCompleta | null
  onClose: () => void
  onSuccess: () => void
}

const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white'
const sel = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white'

export function ModalEditarFalta({ falta, onClose, onSuccess }: Props) {
  const [pending, start] = useTransition()
  const [erro, setErro] = useState('')

  if (!falta) return null

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data_falta = fd.get('data_falta') as string
    const data_fim   = (fd.get('data_fim') as string) || null
    const tipo       = fd.get('tipo') as FaltaTipo
    const observacao = (fd.get('observacao') as string) || null

    if (!data_falta) { setErro('Data de início obrigatória'); return }
    if (!tipo)       { setErro('Tipo obrigatório'); return }

    setErro('')
    start(async () => {
      const result = await editarFalta(falta!.id, { data_falta, data_fim, tipo, observacao })
      if (!result.success) { setErro(result.error ?? 'Erro ao salvar'); return }
      onSuccess()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Editar Falta</h2>
            <p className="text-xs text-gray-400 mt-0.5">{falta.funcionarios?.nome ?? '—'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
                Data Início
              </label>
              <input
                type="date"
                name="data_falta"
                defaultValue={falta.data_falta?.split('T')[0] ?? ''}
                required
                className={inp}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
                Data Fim <span className="font-normal normal-case text-gray-300">(opcional)</span>
              </label>
              <input
                type="date"
                name="data_fim"
                defaultValue={falta.data_fim?.split('T')[0] ?? ''}
                className={inp}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
              Tipo
            </label>
            <select name="tipo" defaultValue={falta.tipo} required className={sel}>
              {FALTA_TIPOS_MANUAIS.map(t => (
                <option key={t} value={t}>{FALTA_TIPO_LABELS[t]}</option>
              ))}
              {/* Preserva 'suspensão' se já era esse tipo */}
              {falta.tipo === 'suspensao' && (
                <option value="suspensao">{FALTA_TIPO_LABELS.suspensao}</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
              Observação
            </label>
            <textarea
              name="observacao"
              defaultValue={falta.observacao ?? ''}
              rows={3}
              className={`${inp} resize-none`}
              placeholder="Opcional"
            />
          </div>

          {erro && <p className="text-sm text-red-500">{erro}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {pending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
