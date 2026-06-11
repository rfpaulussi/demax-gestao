'use client'

import { useState, useTransition, useEffect } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import {
  solicitarDesligamento,
  solicitarTransferencia,
  solicitarMudancaFuncao,
  solicitarAfastamento,
  solicitarRetornoAfastamento,
  solicitarRescisaoIndireta,
} from '@/app/(admin)/efetivo/actions'
import type { FuncionarioRow } from './funcionarios-table'

type TipoSolicitacao =
  | 'desligamento'
  | 'transferencia'
  | 'mudanca_funcao'
  | 'afastamento'
  | 'retorno_afastamento'
  | 'rescisao_indireta'

interface Props {
  funcionario: FuncionarioRow
  postos: { id: string; nome: string; secretaria: string | null }[]
  funcoes: { id: string; nome: string }[]
  open: boolean
  onClose: () => void
}

const TIPO_LABELS: Record<TipoSolicitacao, string> = {
  desligamento:        'Desligamento',
  transferencia:       'Transferência',
  mudanca_funcao:      'Mudança de Função',
  afastamento:         'Afastamento',
  retorno_afastamento: 'Retorno de Afastamento',
  rescisao_indireta:   'Rescisão Indireta',
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

  // Combobox posto destino (transferência)
  const [postoSearch, setPostoSearch]           = useState('')
  const [postoOpen, setPostoOpen]               = useState(false)
  const [postoSelecionado, setPostoSelecionado] = useState<{ id: string; nome: string; secretaria: string | null } | null>(null)

  // Combobox posto retorno (retorno_afastamento)
  const [postoRetornoSearch, setPostoRetornoSearch]           = useState('')
  const [postoRetornoOpen, setPostoRetornoOpen]               = useState(false)
  const [postoRetornoSelecionado, setPostoRetornoSelecionado] = useState<{ id: string; nome: string; secretaria: string | null } | null>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-posto-combobox]'))        setPostoOpen(false)
      if (!target.closest('[data-posto-retorno-combobox]')) setPostoRetornoOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleClose() {
    if (pending) return
    setTipo('')
    setErro(null)
    setPostoSearch(''); setPostoOpen(false); setPostoSelecionado(null)
    setPostoRetornoSearch(''); setPostoRetornoOpen(false); setPostoRetornoSelecionado(null)
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
      if (tipo === 'desligamento')          result = await solicitarDesligamento(fd)
      else if (tipo === 'transferencia')    result = await solicitarTransferencia(fd)
      else if (tipo === 'mudanca_funcao')   result = await solicitarMudancaFuncao(fd)
      else if (tipo === 'afastamento')      result = await solicitarAfastamento(fd)
      else if (tipo === 'retorno_afastamento') result = await solicitarRetornoAfastamento(fd)
      else if (tipo === 'rescisao_indireta')   result = await solicitarRescisaoIndireta(fd)
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
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
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
                <input type="hidden" name="posto_destino_id" value={postoSelecionado?.id ?? ''} required />
                <div className="relative" data-posto-combobox>
                  <input
                    type="text"
                    placeholder="Buscar posto..."
                    value={postoSearch}
                    onChange={e => { setPostoSearch(e.target.value); setPostoOpen(true); setPostoSelecionado(null) }}
                    onFocus={() => setPostoOpen(true)}
                    className={inputClass}
                    autoComplete="off"
                  />
                  {postoOpen && postoSearch.length > 0 && (
                    <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded border border-gray-200 bg-white shadow-lg">
                      {postos
                        .filter(p => p.id !== funcionario.posto_id)
                        .filter(p => {
                          const q = postoSearch.toLowerCase()
                          return p.nome.toLowerCase().includes(q) || (p.secretaria ?? '').toLowerCase().includes(q)
                        })
                        .slice(0, 30)
                        .map(p => (
                          <button key={p.id} type="button"
                            onClick={() => { setPostoSelecionado(p); setPostoSearch(p.nome); setPostoOpen(false) }}
                            className="flex w-full flex-col px-3 py-2 text-left hover:bg-slate-50"
                          >
                            <span className="text-sm font-medium">{p.nome}</span>
                            {p.secretaria && <span className="text-xs text-gray-400">{p.secretaria}</span>}
                          </button>
                        ))}
                      {postos.filter(p => {
                        const q = postoSearch.toLowerCase()
                        return p.id !== funcionario.posto_id && (p.nome.toLowerCase().includes(q) || (p.secretaria ?? '').toLowerCase().includes(q))
                      }).length === 0 && (
                        <p className="px-3 py-2 text-sm text-gray-400">Nenhum posto encontrado.</p>
                      )}
                    </div>
                  )}
                </div>
                {postoSelecionado && (
                  <p className="mt-1 text-xs text-gray-400">
                    Selecionado: <span className="font-medium text-slate-700">{postoSelecionado.nome}</span>
                    {postoSelecionado.secretaria && ` — ${postoSelecionado.secretaria}`}
                  </p>
                )}
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
                  <input type="text" name="motivo" placeholder="Justificativa..." className={inputClass} />
                </div>
              </>
            )}

            {/* afastamento */}
            {tipo === 'afastamento' && (
              <>
                <div>
                  <label className={labelClass}>Motivo do Afastamento</label>
                  <select name="motivo" required className={inputClass}>
                    <option value="">Selecione...</option>
                    <option value="INSS - Doença">INSS — Doença</option>
                    <option value="INSS - Acidente de Trabalho">INSS — Acidente de Trabalho</option>
                    <option value="Licença Maternidade">Licença Maternidade</option>
                    <option value="Licença Paternidade">Licença Paternidade</option>
                    <option value="Afastamento Judicial">Afastamento Judicial</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Data de Início</label>
                  <input type="date" name="data_inicio" required className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Data Prevista de Retorno</label>
                  <input type="date" name="data_retorno_prevista" className={inputClass} />
                </div>
              </>
            )}

            {/* retorno_afastamento */}
            {tipo === 'retorno_afastamento' && (
              <>
                <div>
                  <label className={labelClass}>Data de Retorno</label>
                  <input type="date" name="data_retorno" required className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Posto de Retorno</label>
                  <input type="hidden" name="posto_retorno_id" value={postoRetornoSelecionado?.id ?? ''} />
                  <div className="relative" data-posto-retorno-combobox>
                    <input
                      type="text"
                      placeholder="Buscar posto..."
                      value={postoRetornoSearch}
                      onChange={e => { setPostoRetornoSearch(e.target.value); setPostoRetornoOpen(true); setPostoRetornoSelecionado(null) }}
                      onFocus={() => setPostoRetornoOpen(true)}
                      className={inputClass}
                      autoComplete="off"
                    />
                    {postoRetornoOpen && postoRetornoSearch.length > 0 && (
                      <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded border border-gray-200 bg-white shadow-lg">
                        {postos
                          .filter(p => {
                            const q = postoRetornoSearch.toLowerCase()
                            return p.nome.toLowerCase().includes(q) || (p.secretaria ?? '').toLowerCase().includes(q)
                          })
                          .slice(0, 30)
                          .map(p => (
                            <button key={p.id} type="button"
                              onClick={() => { setPostoRetornoSelecionado(p); setPostoRetornoSearch(p.nome); setPostoRetornoOpen(false) }}
                              className="flex w-full flex-col px-3 py-2 text-left hover:bg-slate-50"
                            >
                              <span className="text-sm font-medium">{p.nome}</span>
                              {p.secretaria && <span className="text-xs text-gray-400">{p.secretaria}</span>}
                            </button>
                          ))}
                        {postos.filter(p => {
                          const q = postoRetornoSearch.toLowerCase()
                          return p.nome.toLowerCase().includes(q) || (p.secretaria ?? '').toLowerCase().includes(q)
                        }).length === 0 && (
                          <p className="px-3 py-2 text-sm text-gray-400">Nenhum posto encontrado.</p>
                        )}
                      </div>
                    )}
                  </div>
                  {postoRetornoSelecionado && (
                    <p className="mt-1 text-xs text-gray-400">
                      Selecionado: <span className="font-medium text-slate-700">{postoRetornoSelecionado.nome}</span>
                      {postoRetornoSelecionado.secretaria && ` — ${postoRetornoSelecionado.secretaria}`}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* rescisao_indireta */}
            {tipo === 'rescisao_indireta' && (
              <>
                <div>
                  <label className={labelClass}>Data da Rescisão</label>
                  <input type="date" name="data_rescisao" required className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Motivo</label>
                  <select name="motivo" required className={inputClass}>
                    <option value="">Selecione...</option>
                    <option value="Falta de Pagamento">Falta de Pagamento</option>
                    <option value="Desvio de Função">Desvio de Função</option>
                    <option value="Assédio Moral">Assédio Moral</option>
                    <option value="Condições de Trabalho Inadequadas">Condições de Trabalho Inadequadas</option>
                    <option value="Alteração Contratual Ilícita">Alteração Contratual Ilícita</option>
                    <option value="Outros">Outros</option>
                  </select>
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
