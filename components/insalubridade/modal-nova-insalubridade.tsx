'use client'

import { useState, useTransition } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { cn } from '@/lib/utils'
import { criarInsalubridade, buscarAgentesHigienizacao } from '@/app/(admin)/insalubridade/actions'
import type { FuncOpt } from '@/app/(admin)/insalubridade/actions'

interface Props {
  open: boolean
  onClose: () => void
  funcionariosOpt: FuncOpt[]
  mesAtual: number
  anoAtual: number
}

const input = 'flex h-9 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'
const lbl   = 'block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5'

export function ModalNovaInsalubridade({ open, onClose, funcionariosOpt, mesAtual, anoAtual }: Props) {
  const [buscaFunc,     setBuscaFunc]     = useState('')
  const [selectedFunc,  setSelectedFunc]  = useState<FuncOpt | null>(null)
  const [agentes,       setAgentes]       = useState<FuncOpt[]>([])
  const [selectedAg,    setSelectedAg]    = useState<FuncOpt | null>(null)
  const [isPending,     startTransition]  = useTransition()

  const mesStr = String(mesAtual).padStart(2, '0')
  const defaultDate = `${anoAtual}-${mesStr}-01`

  const funcFiltradas = buscaFunc
    ? funcionariosOpt.filter(f => f.nome.toLowerCase().includes(buscaFunc.toLowerCase()))
    : funcionariosOpt.slice(0, 80)

  async function onFuncSelect(f: FuncOpt) {
    setSelectedFunc(f)
    const ags = await buscarAgentesHigienizacao(f.postos?.id)
    setAgentes(ags)
  }

  function handleClose() {
    setBuscaFunc('')
    setSelectedFunc(null)
    setAgentes([])
    setSelectedAg(null)
    onClose()
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    if (selectedFunc) formData.set('funcionario_id', selectedFunc.id)
    if (selectedFunc?.postos?.id) formData.set('posto_id', selectedFunc.postos.id)
    if (selectedAg) {
      formData.set('agente_ausente_id', selectedAg.id)
      formData.set('agente_ausente_nome', selectedAg.nome)
    }
    startTransition(async () => {
      await criarInsalubridade(formData)
      form.reset()
      handleClose()
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-1 text-lg font-semibold text-gray-900">
            Nova Declaração
          </Dialog.Title>
          <p className="mb-6 text-sm text-gray-400">Lançamento manual de cobertura insalubre</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Funcionário */}
            <div>
              <label className={lbl}>Buscar funcionário</label>
              <input
                type="text"
                placeholder="Digite para filtrar..."
                value={buscaFunc}
                onChange={e => setBuscaFunc(e.target.value)}
                className={input}
                disabled={!!selectedFunc}
              />
            </div>
            {!selectedFunc ? (
              <div>
                <label className={lbl}>Funcionário *</label>
                <select
                  required
                  onChange={e => {
                    const f = funcionariosOpt.find(x => x.id === e.target.value)
                    if (f) onFuncSelect(f)
                  }}
                  className={input}
                >
                  <option value="">Selecione...</option>
                  {funcFiltradas.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.nome}{f.postos?.nome ? ` — ${f.postos.nome}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedFunc.nome}</p>
                  {selectedFunc.postos && (
                    <p className="text-xs text-gray-500">{selectedFunc.postos.nome} · {selectedFunc.postos.secretaria}</p>
                  )}
                </div>
                <button type="button" onClick={() => { setSelectedFunc(null); setAgentes([]); setSelectedAg(null) }} className="text-xs text-slate-500 hover:underline">Trocar</button>
              </div>
            )}

            {/* Data */}
            <div>
              <label className={lbl}>Data da Cobertura *</label>
              <input type="date" name="data_cobertura" required defaultValue={defaultDate} className={input} />
            </div>

            {/* Agente ausente */}
            {agentes.length > 0 ? (
              <div>
                <label className={lbl}>Agente Ausente</label>
                <select
                  onChange={e => {
                    const ag = agentes.find(a => a.id === e.target.value) ?? null
                    setSelectedAg(ag)
                  }}
                  className={input}
                >
                  <option value="">Selecione ou deixe em branco...</option>
                  {agentes.map(a => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className={lbl}>Agente Ausente (nome livre)</label>
                <input type="text" name="agente_ausente_nome" placeholder="Nome do agente ausente..." className={input} />
              </div>
            )}

            {/* Observação */}
            <div>
              <label className={lbl}>Observação</label>
              <textarea
                name="observacao"
                rows={2}
                placeholder="Observações opcionais..."
                className={cn(input, 'h-auto py-2 resize-none')}
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <button type="button" onClick={handleClose} className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending || !selectedFunc}
                className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {isPending ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
