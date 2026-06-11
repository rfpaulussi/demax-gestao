'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { registrarFalta } from '@/app/(admin)/faltas/actions'
import type { FuncOpt } from '@/app/(admin)/faltas/actions'
import { FALTA_TIPO_LABELS, FALTA_TIPOS_MANUAIS } from './faltas-config'

const inputCls = 'w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600'
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-500'

interface Props {
  open: boolean
  onClose: () => void
  funcionariosOpt: FuncOpt[]
}

export function ModalRegistrarFalta({ open, onClose, funcionariosOpt }: Props) {
  const [busca, setBusca]               = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [selectedFunc, setSelectedFunc] = useState<FuncOpt | null>(null)
  const [dataInicio, setDataInicio]     = useState('')
  const [dataFim, setDataFim]           = useState('')
  const [erro, setErro]                 = useState<string | null>(null)
  const [pending, start]                = useTransition()
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const diasCalculados =
    dataInicio && dataFim && dataFim > dataInicio
      ? Math.ceil((new Date(dataFim).getTime() - new Date(dataInicio).getTime()) / 86400000) + 1
      : null

  const funcsFiltrados = busca.trim()
    ? funcionariosOpt.filter(f => f.nome.toLowerCase().includes(busca.toLowerCase()))
    : funcionariosOpt.slice(0, 60)

  function handleClose() {
    setBusca(''); setDropdownOpen(false); setSelectedFunc(null)
    setDataInicio(''); setDataFim(''); setErro(null)
    onClose()
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedFunc) return
    const fd = new FormData(e.currentTarget)
    fd.set('funcionario_id', selectedFunc.id)
    setErro(null)
    start(async () => {
      const result = await registrarFalta(fd)
      if (!result.success) { setErro(result.error ?? 'Erro ao registrar.'); return }
      handleClose()
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-1 text-lg font-semibold">Registrar Falta</Dialog.Title>
          <p className="mb-6 text-sm text-gray-400">Lançamento de ausência do funcionário</p>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Funcionário */}
            <div>
              <label className={labelCls}>Funcionário *</label>
              {!selectedFunc ? (
                <div className="relative" ref={dropdownRef}>
                  <input
                    type="text"
                    placeholder="Buscar por nome..."
                    value={busca}
                    onChange={e => { setBusca(e.target.value); setDropdownOpen(true) }}
                    onFocus={() => setDropdownOpen(true)}
                    className={inputCls}
                    autoComplete="off"
                  />
                  {dropdownOpen && (
                    <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {funcsFiltrados.length === 0 ? (
                        <p className="px-3 py-4 text-center text-xs text-gray-400">Nenhum resultado</p>
                      ) : funcsFiltrados.map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => { setSelectedFunc(f); setBusca(''); setDropdownOpen(false) }}
                          className="flex w-full flex-col px-3 py-2 text-left hover:bg-slate-50"
                        >
                          <span className="text-sm font-medium">{f.nome}</span>
                          {f.postos && (
                            <span className="text-xs text-gray-400">{f.postos.nome} · {f.postos.secretaria}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{selectedFunc.nome}</p>
                    {selectedFunc.postos && (
                      <p className="mt-0.5 text-xs text-gray-500">{selectedFunc.postos.nome} · {selectedFunc.postos.secretaria}</p>
                    )}
                  </div>
                  <button type="button" onClick={() => setSelectedFunc(null)} className="text-xs text-slate-500 hover:underline">
                    Trocar
                  </button>
                </div>
              )}
            </div>

            {/* Datas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Data Início *</label>
                <input
                  type="date"
                  name="data_falta"
                  required
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Data Fim</label>
                <input
                  type="date"
                  name="data_fim"
                  min={dataInicio}
                  value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            {diasCalculados !== null && (
              <p className="text-xs text-slate-600">
                <span className="font-semibold">{diasCalculados} dia{diasCalculados !== 1 ? 's' : ''}</span> calculado{diasCalculados !== 1 ? 's' : ''} automaticamente
              </p>
            )}

            {/* Tipo */}
            <div>
              <label className={labelCls}>Tipo *</label>
              <select name="tipo" required className={inputCls}>
                <option value="">Selecione...</option>
                {FALTA_TIPOS_MANUAIS.map(v => (
                  <option key={v} value={v}>{FALTA_TIPO_LABELS[v]}</option>
                ))}
              </select>
            </div>

            {/* Observação */}
            <div>
              <label className={labelCls}>Observação</label>
              <textarea
                name="observacao"
                rows={2}
                placeholder="Observações opcionais..."
                className={inputCls}
              />
            </div>

            {erro && (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>
            )}

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={pending}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending || !selectedFunc}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {pending ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
