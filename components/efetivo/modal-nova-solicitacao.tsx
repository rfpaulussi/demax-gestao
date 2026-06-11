'use client'

import { useState, useTransition } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import {
  solicitarDesligamento,
  solicitarTransferencia,
  solicitarMudancaFuncao,
} from '@/app/(admin)/efetivo/actions'
import type { FuncionarioRow } from './funcionarios-table'

type TipoSolicitacao =
  | 'desligamento'
  | 'transferencia'
  | 'mudanca_funcao'

interface Props {
  funcionario: FuncionarioRow
  postos: { id: string; nome: string }[]
  funcoes: { id: string; nome: string }[]
  open: boolean
  onClose: () => void
}

const TIPO_LABELS: Record<TipoSolicitacao, string> = {
  desligamento:   'Desligamento',
  transferencia:  'Transferência',
  mudanca_funcao: 'Mudança de Função',
}

const MOTIVOS_DESLIGAMENTO = [
  'PESSOAL', 'RESCISÃO INDIRETA', 'ADAPTAÇÃO', 'COMPORTAMENTAL',
  'FALTAS EXCESSIVAS', 'ABANDONO', 'CORTE DE CUSTO', 'DEFICIÊNCIA TÉCNICA',
  'SALÁRIO', 'FALECIMENTO', 'JUSTA CAUSA',
]

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500'
const inputClass =
  'w-full rounded border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600'

export function ModalNovaSolicitacao({ funcionario, postos, funcoes, open, onClose }: Props) {
  const [tipo, setTipo]   = useState<TipoSolicitacao | ''>('')
  const [erro, setErro]   = useState<string | null>(null)
  const [pending, start]  = useTransition()

  function handleClose() {
    if (pending) return
    setTipo('')
    setErro(null)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!tipo) return
    setErro(null)
    const fd = new FormData(e.currentTarget)
    fd.set('funcionario_id', funcionario.id)

    start(async () => {
      let result
      if (tipo === 'desligamento')        result = await solicitarDesligamento(fd)
      else if (tipo === 'transferencia')  result = await solicitarTransferencia(fd)
      else if (tipo === 'mudanca_funcao') result = await solicitarMudancaFuncao(fd)
      else return

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
          <Dialog.Title className="mb-1 text-lg font-semibold">Nova Solicitação</Dialog.Title>
          <p className="mb-4 text-sm text-gray-400">{funcionario.nome}</p>

          <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Esta solicitação será enviada para aprovação do administrador antes de ser efetivada.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* tipo */}
            <div>
              <label className={labelClass}>Tipo</label>
              <select
                name="tipo"
                required
                value={tipo}
                onChange={e => { setTipo(e.target.value as TipoSolicitacao | ''); setErro(null) }}
                className={inputClass}
              >
                <option value="">Selecione...</option>
                {(Object.entries(TIPO_LABELS) as [TipoSolicitacao, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {/* desligamento */}
            {tipo === 'desligamento' && (
              <>
                <div>
                  <label className={labelClass}>Data de Desligamento</label>
                  <input type="date" name="data_desligamento" required className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Motivo</label>
                  <select name="motivo" required className={inputClass}>
                    <option value="">Selecione...</option>
                    {MOTIVOS_DESLIGAMENTO.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* transferencia */}
            {tipo === 'transferencia' && (
              <div>
                <label className={labelClass}>Posto Destino</label>
                <select name="posto_destino_id" required className={inputClass}>
                  <option value="">Selecione...</option>
                  {postos
                    .filter(p => p.id !== funcionario.posto_id)
                    .map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
            )}

            {/* mudanca_funcao */}
            {tipo === 'mudanca_funcao' && (
              <>
                <div>
                  <label className={labelClass}>Nova Função</label>
                  <select name="funcao_destino_id" required className={inputClass}>
                    <option value="">Selecione...</option>
                    {funcoes
                      .filter(f => f.id !== funcionario.funcoes?.id)
                      .map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Motivo</label>
                  <input
                    type="text"
                    name="motivo"
                    placeholder="Justificativa..."
                    className={inputClass}
                  />
                </div>
              </>
            )}

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
                disabled={pending || !tipo}
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
