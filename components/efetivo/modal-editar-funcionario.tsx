'use client'

import { useState, useTransition } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { editarFuncionario } from '@/app/(admin)/efetivo/actions'
import type { FuncionarioRow } from './funcionarios-table'

const MOTIVOS_DESLIGAMENTO = [
  'PESSOAL', 'RESCISÃO INDIRETA', 'ADAPTAÇÃO', 'COMPORTAMENTAL',
  'FALTAS EXCESSIVAS', 'ABANDONO', 'CORTE DE CUSTO', 'DEFICIÊNCIA TÉCNICA',
  'SALÁRIO', 'FALECIMENTO', 'JUSTA CAUSA',
]

const STATUS_LOCKED_LABEL: Record<string, string> = {
  afastado: 'Afastado',
  ferias:   'Em Férias',
}

interface Props {
  funcionario: FuncionarioRow
  postos: { id: string; nome: string; secretaria: string | null }[]
  funcoes: { id: string; nome: string }[]
  open: boolean
  onClose: () => void
}

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600'
const inputClass = 'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600'

export function ModalEditarFuncionario({ funcionario, postos, funcoes, open, onClose }: Props) {
  const isStatusLocked = funcionario.status === 'afastado' || funcionario.status === 'ferias'

  const [nome,               setNome]               = useState(funcionario.nome)
  const [funcaoId,           setFuncaoId]           = useState(funcionario.funcoes?.id ?? '')
  const [postoId,            setPostoId]            = useState(funcionario.posto_id ?? '')
  const [dataAdmissao,       setDataAdmissao]       = useState(funcionario.data_admissao ?? '')
  const [status,             setStatus]             = useState<'ativo' | 'desligado'>(
    funcionario.status === 'desligado' ? 'desligado' : 'ativo',
  )
  const [dataDesligamento,   setDataDesligamento]   = useState(funcionario.data_desligamento ?? '')
  const [motivoDesligamento, setMotivoDesligamento] = useState(funcionario.motivo_desligamento ?? '')
  const [erro,               setErro]               = useState<string | null>(null)
  const [pending,            start]                 = useTransition()

  function handleClose() {
    if (pending) return
    setErro(null)
    onClose()
  }

  function handleStatusChange(v: 'ativo' | 'desligado') {
    setStatus(v)
    if (v === 'ativo') {
      setDataDesligamento('')
      setMotivoDesligamento('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    // Quando status está bloqueado (afastado/ferias), preserva o status original
    const statusEnviado = isStatusLocked
      ? (funcionario.status as 'ativo' | 'afastado' | 'ferias' | 'desligado')
      : status

    start(async () => {
      const result = await editarFuncionario(funcionario.id, {
        nome,
        funcao_id:           funcaoId,
        posto_id:            postoId,
        data_admissao:       dataAdmissao || null,
        status:              statusEnviado,
        data_desligamento:   statusEnviado === 'ativo' ? null : dataDesligamento || null,
        motivo_desligamento: statusEnviado === 'ativo' ? null : motivoDesligamento || null,
      })
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
          <Dialog.Title className="mb-1 text-lg font-semibold">Editar Funcionário</Dialog.Title>
          <p className="mb-4 text-sm text-gray-500">{funcionario.nome}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>Nome Completo</label>
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Função</label>
              <select value={funcaoId} onChange={e => setFuncaoId(e.target.value)} required className={inputClass}>
                <option value="">Selecione...</option>
                {funcoes.map(f => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Posto</label>
              <select value={postoId} onChange={e => setPostoId(e.target.value)} required className={inputClass}>
                <option value="">Selecione...</option>
                {postos.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Data de Admissão</label>
              <input
                type="date"
                value={dataAdmissao}
                onChange={e => setDataAdmissao(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Status</label>
              {isStatusLocked ? (
                <>
                  <div className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                    {STATUS_LOCKED_LABEL[funcionario.status!]}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Para alterar este status, use o botão Afastar/Retorno na tabela de Efetivo ou o módulo Férias.
                  </p>
                </>
              ) : (
                <select
                  value={status}
                  onChange={e => handleStatusChange(e.target.value as 'ativo' | 'desligado')}
                  className={inputClass}
                >
                  <option value="ativo">Ativo</option>
                  <option value="desligado">Desligado</option>
                </select>
              )}
            </div>

            {!isStatusLocked && status === 'desligado' && (
              <>
                <div>
                  <label className={labelClass}>Data de Desligamento</label>
                  <input
                    type="date"
                    value={dataDesligamento}
                    onChange={e => setDataDesligamento(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Motivo do Desligamento</label>
                  <select
                    value={motivoDesligamento}
                    onChange={e => setMotivoDesligamento(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Selecione...</option>
                    {MOTIVOS_DESLIGAMENTO.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
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
                disabled={pending}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {pending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
