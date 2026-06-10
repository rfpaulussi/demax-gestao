'use client'

import { useState, useTransition } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { cn } from '@/lib/utils'
import { criarAdvertencia } from '@/app/(admin)/advertencias/actions'
import type { FuncionarioOpt } from '@/app/(admin)/advertencias/actions'

const NATUREZA_OPTS = [
  { value: 'comportamento',  label: 'Comportamento Inadequado' },
  { value: 'falta',          label: 'Falta Injustificada'      },
  { value: 'atraso',         label: 'Atraso Recorrente'        },
  { value: 'negligencia',    label: 'Negligência no Trabalho'  },
  { value: 'descumprimento', label: 'Descumprimento de Normas' },
  { value: 'outro',          label: 'Outro'                    },
]

interface Props {
  open: boolean
  onClose: () => void
  funcionarios: FuncionarioOpt[]
  reincidencias: Record<string, number>
}

const input  = 'flex h-9 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'
const lbl    = 'block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5'
const secTtl = 'text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-100 pb-2 mb-4'

export function ModalAdvertencia({ open, onClose, funcionarios, reincidencias }: Props) {
  const [selectedId, setSelectedId] = useState('')
  const [grau,       setGrau]       = useState('')
  const [busca,      setBusca]      = useState('')
  const [isPending,  startTransition] = useTransition()

  const funcFiltradas = busca
    ? funcionarios.filter(f => f.nome.toLowerCase().includes(busca.toLowerCase()))
    : funcionarios.slice(0, 80)

  const reinc = selectedId ? (reincidencias[selectedId] ?? 0) : 0

  function handleClose() {
    setSelectedId('')
    setGrau('')
    setBusca('')
    onClose()
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const form = e.currentTarget
    startTransition(async () => {
      try {
        await criarAdvertencia(formData)
        form.reset()
        handleClose()
      } catch (err) {
        console.error('Erro ao criar advertência:', err)
        alert('Erro ao salvar advertência: ' + (err instanceof Error ? err.message : 'Erro desconhecido'))
      }
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-6 shadow-xl">

          <Dialog.Title className="mb-1 text-lg font-semibold text-gray-900">
            Nova Advertência
          </Dialog.Title>
          <p className="mb-6 text-sm text-gray-400">Registro de medida disciplinar</p>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* 1. Colaborador */}
            <div>
              <p className={secTtl}>1. Colaborador</p>
              <div className="space-y-3">
                <div>
                  <label className={lbl}>Buscar pelo nome</label>
                  <input
                    type="text"
                    placeholder="Digite para filtrar..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    className={input}
                  />
                </div>
                <div>
                  <label className={lbl}>Funcionário *</label>
                  <select
                    name="funcionario_id"
                    required
                    value={selectedId}
                    onChange={e => setSelectedId(e.target.value)}
                    className={input}
                  >
                    <option value="">Selecione o colaborador...</option>
                    {funcFiltradas.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.nome}{f.postos?.nome ? ` - ${f.postos.nome}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {reinc > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                    <span className="text-sm font-semibold text-red-700">
                      Reincidente: {reinc} advertência{reinc > 1 ? 's' : ''} anterior{reinc > 1 ? 'es' : ''} registrada{reinc > 1 ? 's' : ''}.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Ocorrência */}
            <div>
              <p className={secTtl}>2. Ocorrência</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Data da Ocorrência *</label>
                  <input type="date" name="data_ocorrencia" required className={input} />
                </div>
                <div>
                  <label className={lbl}>Horário</label>
                  <input type="time" name="horario_fato" className={input} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Natureza da Infração</label>
                  <select name="natureza" className={input}>
                    <option value="">Selecione...</option>
                    {NATUREZA_OPTS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Relato Detalhado</label>
                  <textarea
                    name="relato"
                    rows={3}
                    placeholder="Descreva o ocorrido com detalhes..."
                    className={cn(input, 'h-auto py-2 resize-none')}
                  />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Observações Internas</label>
                  <textarea
                    name="descricao"
                    rows={2}
                    placeholder="Notas internas (não aparece no PDF)..."
                    className={cn(input, 'h-auto py-2 resize-none')}
                  />
                </div>
              </div>
            </div>

            {/* 3. Medida Disciplinar */}
            <div>
              <p className={secTtl}>3. Medida Disciplinar</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Grau *</label>
                  <select
                    name="grau"
                    required
                    value={grau}
                    onChange={e => setGrau(e.target.value)}
                    className={input}
                  >
                    <option value="">Selecione...</option>
                    <option value="verbal">Advertência Verbal</option>
                    <option value="escrita">Advertência Escrita</option>
                    <option value="suspensao">Suspensão</option>
                  </select>
                </div>
                {grau === 'suspensao' && (
                  <div>
                    <label className={lbl}>Dias de Suspensão *</label>
                    <input
                      type="number"
                      name="dias_suspensao"
                      min={1}
                      max={30}
                      required
                      className={input}
                    />
                  </div>
                )}
                <div>
                  <label className={lbl}>Data de Aplicação</label>
                  <input type="date" name="data_aplicacao" className={input} />
                </div>
                <div>
                  <label className={lbl}>Aplicado por (supervisor)</label>
                  <input
                    type="text"
                    name="registrado_por"
                    placeholder="Nome do responsável..."
                    className={input}
                  />
                </div>
              </div>
            </div>

            {/* 4. Testemunhas e Defesa */}
            <div>
              <p className={secTtl}>4. Testemunhas e Defesa</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Testemunha 1</label>
                  <input
                    type="text"
                    name="testemunha_1"
                    placeholder="Nome completo..."
                    className={input}
                  />
                </div>
                <div>
                  <label className={lbl}>Testemunha 2</label>
                  <input
                    type="text"
                    name="testemunha_2"
                    placeholder="Nome completo..."
                    className={input}
                  />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Defesa do Colaborador</label>
                  <textarea
                    name="defesa_colaborador"
                    rows={3}
                    placeholder="Registro da defesa apresentada pelo colaborador..."
                    className={cn(input, 'h-auto py-2 resize-none')}
                  />
                </div>
              </div>
            </div>

            {/* Acoes */}
            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
              >
                {isPending ? 'Salvando...' : 'Registrar Advertência'}
              </button>
            </div>

          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
