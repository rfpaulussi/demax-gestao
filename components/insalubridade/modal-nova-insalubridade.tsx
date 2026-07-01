'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { criarInsalubridade, buscarAgentesPorPosto } from '@/app/(admin)/insalubridade/actions'
import type { FuncOpt } from '@/app/(admin)/insalubridade/actions'

interface Props {
  open: boolean
  onClose: () => void
  funcionariosOpt: FuncOpt[]
  postos: { id: string; nome: string; secretaria: string | null }[]
  mesAtual: number
  anoAtual: number
}

const input = 'flex h-9 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'
const lbl   = 'block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5'

const FUNCAO_BADGE_CLS: Array<{ test: (n: string) => boolean; cls: string }> = [
  { test: n => n.includes('AJUDANTE'),                                                                              cls: 'text-blue-600 bg-blue-50'     },
  { test: n => n.includes('HIGIENIZA') || n.includes('AGENTE'),                                                    cls: 'text-purple-600 bg-purple-50' },
  { test: n => n.includes('JARDINEIRO') || n.includes('ROÇADOR') || n.includes('ROCADOR') || n.includes('VERDE'), cls: 'text-green-600 bg-green-50'   },
  { test: n => n.includes('JOVEM APRENDIZ') || n.includes('APRENDIZ'),                                             cls: 'text-orange-600 bg-orange-50' },
]

function funcaoBadgeCls(nome: string): string {
  const n = nome.toUpperCase()
  return FUNCAO_BADGE_CLS.find(e => e.test(n))?.cls ?? 'text-gray-600 bg-gray-100'
}

export function ModalNovaInsalubridade({ open, onClose, funcionariosOpt, postos, mesAtual, anoAtual }: Props) {
  const [selectedPosto,      setSelectedPosto]      = useState<{ id: string; nome: string; secretaria: string | null } | null>(null)
  const [buscaSubstituto,    setBuscaSubstituto]    = useState('')
  const [selectedSubstituto, setSelectedSubstituto] = useState<FuncOpt | null>(null)
  const [dropdownOpen,       setDropdownOpen]       = useState(false)
  const [ausentes,           setAusentes]           = useState<FuncOpt[]>([])
  const [selectedAusente,    setSelectedAusente]    = useState<FuncOpt | null>(null)
  const [erroSubmit,         setErroSubmit]         = useState<string | null>(null)
  const [isPending,          startTransition]       = useTransition()

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  const mesStr = String(mesAtual).padStart(2, '0')
  const defaultDate = `${anoAtual}-${mesStr}-01`

  const substitutosFiltrados = buscaSubstituto
    ? funcionariosOpt.filter(f => f.nome.toLowerCase().includes(buscaSubstituto.toLowerCase()))
    : funcionariosOpt.slice(0, 80)

  async function onPostoSelect(posto: { id: string; nome: string; secretaria: string | null }) {
    setSelectedPosto(posto)
    setSelectedAusente(null)
    const ags = await buscarAgentesPorPosto(posto.id)
    setAusentes(ags)
  }

  function handleClose() {
    setSelectedPosto(null)
    setBuscaSubstituto('')
    setSelectedSubstituto(null)
    setDropdownOpen(false)
    setAusentes([])
    setSelectedAusente(null)
    setErroSubmit(null)
    onClose()
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    if (selectedSubstituto) formData.set('funcionario_id', selectedSubstituto.id)
    if (selectedPosto) formData.set('posto_id', selectedPosto.id)
    if (selectedAusente) {
      formData.set('agente_ausente_id', selectedAusente.id)
      formData.set('agente_ausente_nome', selectedAusente.nome)
    }
    setErroSubmit(null)
    startTransition(async () => {
      const res = await criarInsalubridade(formData)
      if (res?.error) {
        setErroSubmit(res.error)
      } else {
        form.reset()
        handleClose()
      }
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
            {/* Posto */}
            {!selectedPosto ? (
              <div>
                <label className={lbl}>Posto *</label>
                <select
                  required
                  onChange={e => {
                    const p = postos.find(x => x.id === e.target.value)
                    if (p) onPostoSelect(p)
                  }}
                  className={input}
                >
                  <option value="">Selecione o posto...</option>
                  {Object.entries(
                    postos.reduce<Record<string, typeof postos>>((acc, p) => {
                      const sec = p.secretaria ?? 'Outros'
                      if (!acc[sec]) acc[sec] = []
                      acc[sec].push(p)
                      return acc
                    }, {})
                  )
                    .sort(([a], [b]) => {
                      if (a === 'Outros') return 1
                      if (b === 'Outros') return -1
                      return a.localeCompare(b)
                    })
                    .map(([sec, lista]) => (
                      <optgroup key={sec} label={sec}>
                        {lista.sort((a, b) => a.nome.localeCompare(b.nome)).map(p => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </optgroup>
                    ))
                  }
                </select>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedPosto.nome}</p>
                  {selectedPosto.secretaria && (
                    <p className="text-xs text-gray-500">{selectedPosto.secretaria}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedPosto(null); setAusentes([]); setSelectedAusente(null) }}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Trocar
                </button>
              </div>
            )}

            {/* Substituto */}
            <div>
              <label className={lbl}>Substituto *</label>
              {!selectedSubstituto ? (
                <div className="relative" ref={dropdownRef}>
                  {/* Trigger */}
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(v => !v)}
                    className={cn(input, 'flex items-center justify-between cursor-pointer')}
                  >
                    <span className="text-gray-400">Selecione...</span>
                    <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', dropdownOpen && 'rotate-180')} />
                  </button>

                  {/* Dropdown panel */}
                  {dropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                      {/* Search */}
                      <div className="border-b border-gray-100 p-2">
                        <input
                          type="text"
                          placeholder="Buscar por nome..."
                          value={buscaSubstituto}
                          onChange={e => setBuscaSubstituto(e.target.value)}
                          className="flex h-8 w-full rounded-md border border-gray-200 bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                          autoFocus
                        />
                      </div>

                      {/* List */}
                      <div className="max-h-64 overflow-y-auto">
                        {substitutosFiltrados.length === 0 ? (
                          <p className="px-3 py-4 text-center text-xs text-gray-400">Nenhum resultado</p>
                        ) : (
                          substitutosFiltrados.map(f => (
                            <div
                              key={f.id}
                              onClick={() => {
                                setSelectedSubstituto(f)
                                setDropdownOpen(false)
                                setBuscaSubstituto('')
                              }}
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
                    <p className="text-sm font-medium text-gray-900">{selectedSubstituto.nome}</p>
                    {selectedSubstituto.funcoes?.nome && (
                      <span className={cn('mt-0.5 inline-block px-1.5 py-0.5 rounded text-xs font-medium', funcaoBadgeCls(selectedSubstituto.funcoes.nome))}>
                        {selectedSubstituto.funcoes.nome}
                      </span>
                    )}
                    {selectedSubstituto.postos && (
                      <p className="text-xs text-gray-500 mt-0.5">{selectedSubstituto.postos.nome} · {selectedSubstituto.postos.secretaria}</p>
                    )}
                  </div>
                  <button type="button" onClick={() => setSelectedSubstituto(null)} className="text-xs text-slate-500 hover:underline">Trocar</button>
                </div>
              )}
            </div>

            {/* Agente ausente */}
            <div>
              <label className={lbl}>Agente Ausente</label>
              {ausentes.length > 0 ? (
                <select
                  onChange={e => {
                    const ag = ausentes.find(a => a.id === e.target.value) ?? null
                    setSelectedAusente(ag)
                  }}
                  className={input}
                >
                  <option value="">Selecione ou deixe em branco...</option>
                  {ausentes.map(a => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name="agente_ausente_nome"
                  placeholder={selectedPosto ? 'Nenhum agente ativo neste posto' : 'Selecione um posto primeiro...'}
                  className={input}
                  disabled={!selectedPosto || ausentes.length === 0}
                />
              )}
            </div>

            {/* Data */}
            <div>
              <label className={lbl}>Data da Cobertura *</label>
              <input type="date" name="data_cobertura" required defaultValue={defaultDate} className={input} />
            </div>

            {/* Período (dias) */}
            <div>
              <label className={lbl}>Período (dias) *</label>
              <input type="number" name="periodo_dias" required min={1} defaultValue={1} className={input} />
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
                disabled={isPending || !selectedPosto || !selectedSubstituto}
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
