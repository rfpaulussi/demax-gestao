'use client'

import { useState, useTransition } from 'react'
import { Dialog } from '@base-ui/react/dialog'
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

function funcaoBadgeCls(nome: string): string {
  const n = nome.toUpperCase()
  if (n.includes('AJUDANTE')) return 'text-blue-600 bg-blue-50'
  if (n.includes('HIGIENIZA') || n.includes('AGENTE')) return 'text-purple-600 bg-purple-50'
  if (n.includes('JARDINEIRO') || n.includes('ROÇADOR') || n.includes('ROCADOR') || n.includes('ÁREA VERDE') || n.includes('AREA VERDE')) return 'text-green-600 bg-green-50'
  return 'text-gray-600 bg-gray-100'
}

export function ModalNovaInsalubridade({ open, onClose, funcionariosOpt, postos, mesAtual, anoAtual }: Props) {
  const [selectedPosto,      setSelectedPosto]      = useState<{ id: string; nome: string; secretaria: string | null } | null>(null)
  const [buscaSubstituto,    setBuscaSubstituto]    = useState('')
  const [selectedSubstituto, setSelectedSubstituto] = useState<FuncOpt | null>(null)
  const [ausentes,           setAusentes]           = useState<FuncOpt[]>([])
  const [selectedAusente,    setSelectedAusente]    = useState<FuncOpt | null>(null)
  const [isPending,          startTransition]       = useTransition()

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
    setAusentes([])
    setSelectedAusente(null)
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
                  {postos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome}{p.secretaria ? ` — ${p.secretaria}` : ''}
                    </option>
                  ))}
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
              <label className={lbl}>Buscar substituto</label>
              <input
                type="text"
                placeholder="Digite para filtrar..."
                value={buscaSubstituto}
                onChange={e => setBuscaSubstituto(e.target.value)}
                className={input}
                disabled={!!selectedSubstituto}
              />
            </div>
            {!selectedSubstituto ? (
              <div>
                <label className={lbl}>Substituto *</label>
                <select
                  required
                  onChange={e => {
                    const f = funcionariosOpt.find(x => x.id === e.target.value)
                    if (f) setSelectedSubstituto(f)
                  }}
                  className={input}
                >
                  <option value="">Selecione...</option>
                  {substitutosFiltrados.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.funcoes?.nome ? `[${f.funcoes.nome}] ` : ''}{f.nome}{f.postos?.nome ? ` — ${f.postos.nome}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedSubstituto.nome}</p>
                  {selectedSubstituto.funcoes?.nome && (
                    <span className={`mt-0.5 inline-block px-1.5 py-0.5 rounded text-xs font-medium ${funcaoBadgeCls(selectedSubstituto.funcoes.nome)}`}>
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
