'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { criarFalta } from '@/app/(admin)/faltas/actions'
import type { FuncOpt } from '@/app/(admin)/faltas/actions'

interface Props {
  open: boolean
  onClose: () => void
  funcionariosOpt: FuncOpt[]
  mesAtual: number
  anoAtual: number
}

const input = 'flex h-9 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'
const lbl   = 'block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5'

const FUNCAO_BADGE_CLS: Array<{ test: (n: string) => boolean; cls: string }> = [
  { test: n => n.includes('AJUDANTE'),                                                                              cls: 'text-blue-600 bg-blue-50'     },
  { test: n => n.includes('HIGIENIZA') || n.includes('AGENTE'),                                                    cls: 'text-purple-600 bg-purple-50' },
  { test: n => n.includes('JARDINEIRO') || n.includes('ROÇADOR') || n.includes('ROCADOR') || n.includes('VERDE'), cls: 'text-green-600 bg-green-50'   },
  { test: n => n.includes('APRENDIZ'),                                                                              cls: 'text-orange-600 bg-orange-50' },
]

function funcaoBadgeCls(nome: string): string {
  const n = nome.toUpperCase()
  return FUNCAO_BADGE_CLS.find(e => e.test(n))?.cls ?? 'text-gray-600 bg-gray-100'
}

export function ModalFalta({ open, onClose, funcionariosOpt, mesAtual, anoAtual }: Props) {
  const [busca,              setBusca]              = useState('')
  const [selectedFunc,       setSelectedFunc]       = useState<FuncOpt | null>(null)
  const [dropdownOpen,       setDropdownOpen]       = useState(false)
  const [tipoSelecionado,    setTipoSelecionado]    = useState('')
  const [temDocumento,       setTemDocumento]       = useState(false)
  const [erroSubmit,         setErroSubmit]         = useState<string | null>(null)
  const [isPending,          startTransition]       = useTransition()

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    function onOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [dropdownOpen])

  const mesStr     = String(mesAtual).padStart(2, '0')
  const defaultDate = `${anoAtual}-${mesStr}-01`

  const funcsFiltrados = busca
    ? funcionariosOpt.filter(f => f.nome.toLowerCase().includes(busca.toLowerCase()))
    : funcionariosOpt.slice(0, 80)

  function handleClose() {
    setBusca('')
    setSelectedFunc(null)
    setDropdownOpen(false)
    setTipoSelecionado('')
    setTemDocumento(false)
    setErroSubmit(null)
    onClose()
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    if (selectedFunc) formData.set('funcionario_id', selectedFunc.id)
    formData.set('tem_documento', String(temDocumento))

    setErroSubmit(null)
    startTransition(async () => {
      try {
        await criarFalta(formData)
        form.reset()
        handleClose()
      } catch (err) {
        setErroSubmit(err instanceof Error ? err.message : 'Erro ao registrar falta.')
      }
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-1 text-lg font-semibold text-gray-900">
            Registrar Falta
          </Dialog.Title>
          <p className="mb-6 text-sm text-gray-400">Lançamento de ausência do funcionário</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Funcionário */}
            <div>
              <label className={lbl}>Funcionário *</label>
              {!selectedFunc ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(v => !v)}
                    className={cn(input, 'flex items-center justify-between cursor-pointer')}
                  >
                    <span className="text-gray-400">Selecione...</span>
                    <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', dropdownOpen && 'rotate-180')} />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                      <div className="border-b border-gray-100 p-2">
                        <input
                          type="text"
                          placeholder="Buscar por nome..."
                          value={busca}
                          onChange={e => setBusca(e.target.value)}
                          className="flex h-8 w-full rounded-md border border-gray-200 bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {funcsFiltrados.length === 0 ? (
                          <p className="px-3 py-4 text-center text-xs text-gray-400">Nenhum resultado</p>
                        ) : (
                          funcsFiltrados.map(f => (
                            <div
                              key={f.id}
                              onClick={() => { setSelectedFunc(f); setDropdownOpen(false); setBusca('') }}
                              className="cursor-pointer px-3 py-2 hover:bg-gray-50"
                            >
                              <p className="text-sm font-medium text-gray-900">{f.nome}</p>
                              {f.funcoes?.nome && (
                                <span className={cn('mt-0.5 inline-block px-1.5 py-0.5 rounded text-xs font-medium', funcaoBadgeCls(f.funcoes.nome))}>
                                  {f.funcoes.nome}
                                </span>
                              )}
                              {f.postos && (
                                <p className="text-xs text-gray-500">{f.postos.nome} · {f.postos.secretaria}</p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedFunc.nome}</p>
                    {selectedFunc.funcoes?.nome && (
                      <span className={cn('mt-0.5 inline-block px-1.5 py-0.5 rounded text-xs font-medium', funcaoBadgeCls(selectedFunc.funcoes.nome))}>
                        {selectedFunc.funcoes.nome}
                      </span>
                    )}
                    {selectedFunc.postos && (
                      <p className="text-xs text-gray-500 mt-0.5">{selectedFunc.postos.nome} · {selectedFunc.postos.secretaria}</p>
                    )}
                  </div>
                  <button type="button" onClick={() => setSelectedFunc(null)} className="text-xs text-slate-500 hover:underline">
                    Trocar
                  </button>
                </div>
              )}
            </div>

            {/* Data */}
            <div>
              <label className={lbl}>Data da Falta *</label>
              <input type="date" name="data_falta" required defaultValue={defaultDate} className={input} />
            </div>

            {/* Tipo */}
            <div>
              <label className={lbl}>Tipo *</label>
              <select
                name="tipo"
                required
                className={input}
                value={tipoSelecionado}
                onChange={e => setTipoSelecionado(e.target.value)}
              >
                <option value="">Selecione...</option>
                <option value="sem_justificativa">Sem Justificativa</option>
                <option value="declaracao">Declaração</option>
                <option value="suspensao">Suspensão</option>
              </select>
            </div>

            {/* Tem documento */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="tem_documento"
                checked={temDocumento}
                onChange={e => setTemDocumento(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 accent-slate-900"
              />
              <label htmlFor="tem_documento" className="text-sm text-gray-700">
                Tem documento?
              </label>
            </div>

            {/* Justificativa — obrigatório quando tipo = declaracao */}
            {tipoSelecionado === 'declaracao' && (
              <div>
                <label className={lbl}>Justificativa *</label>
                <textarea
                  name="justificativa"
                  required
                  rows={2}
                  placeholder="Descreva a justificativa..."
                  className={cn(input, 'h-auto py-2 resize-none')}
                />
              </div>
            )}

            {/* Dias */}
            <div>
              <label className={lbl}>Dias</label>
              <input
                type="number"
                name="dias"
                min={1}
                defaultValue={1}
                className={input}
              />
            </div>

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

            {erroSubmit && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {erroSubmit}
              </p>
            )}

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
