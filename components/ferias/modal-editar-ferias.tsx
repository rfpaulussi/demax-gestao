'use client'

import { useState, useTransition } from 'react'
import { editarFerias, type FeriasListaItem } from '@/app/(admin)/ferias/actions'

interface Props {
  item: FeriasListaItem | null
  onClose: () => void
  onSuccess: () => void
}

function formatDateInput(str: string | null): string {
  if (!str) return ''
  return str.split('T')[0]
}

function calcDias(inicio: string, fim: string): number | null {
  if (!inicio || !fim) return null
  const d1 = new Date(inicio)
  const d2 = new Date(fim)
  const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1
  return diff > 0 ? diff : null
}

export function ModalEditarFerias({ item, onClose, onSuccess }: Props) {
  const [dataInicio, setDataInicio] = useState(formatDateInput(item?.data_inicio ?? null))
  const [dataFim, setDataFim] = useState(formatDateInput(item?.data_fim ?? null))
  const [status, setStatus] = useState(item?.status ?? 'disponivel')
  const [observacao, setObservacao] = useState('')
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendingSave, startSave] = useTransition()
  const [pendingDelete, startDelete] = useTransition()

  if (!item) return null

  function handleSalvar() {
    setErro(null)
    const diasUtilizados = dataInicio && dataFim ? calcDias(dataInicio, dataFim) : null
    startSave(async () => {
      try {
        await editarFerias(item!.id, {
          data_inicio: dataInicio || null,
          data_fim: dataFim || null,
          dias_utilizados: diasUtilizados,
          status,
          observacao: observacao || null,
        })
        onSuccess()
        onClose()
      } catch (e: unknown) {
        setErro(e instanceof Error ? e.message : 'Erro ao salvar')
      }
    })
  }

  function handleLimparDatas() {
    startDelete(async () => {
      try {
        await editarFerias(item!.id, {
          data_inicio: null,
          data_fim: null,
          dias_utilizados: null,
          status: 'disponivel',
          observacao: null,
        })
        onSuccess()
        onClose()
      } catch (e: unknown) {
        setErro(e instanceof Error ? e.message : 'Erro ao limpar datas')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Editar Férias</h2>
            <p className="text-sm text-slate-500 mt-0.5">{item.funcionario_nome} · {item.funcionario_registro}</p>
            <p className="text-xs text-slate-400 mt-0.5">{item.numero_periodo}º período · {item.posto_nome}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Data Início</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Data Fim</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
        </div>

        {dataInicio && dataFim && (
          <p className="text-xs text-slate-500">Dias calculados: <strong>{calcDias(dataInicio, dataFim) ?? '—'}</strong></p>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300">
            <option value="disponivel">Disponível</option>
            <option value="agendado">Agendado</option>
            <option value="aprovado">Aprovado</option>
            <option value="em_curso">Em Curso</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Observação</label>
          <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2} placeholder="Opcional..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none" />
        </div>

        {erro && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{erro}</p>}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          {!confirmandoLimpeza ? (
            <button onClick={() => setConfirmandoLimpeza(true)} className="text-sm text-amber-600 hover:text-amber-800 font-medium">
              Limpar datas
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-amber-700 font-medium">Limpar datas de gozo?</span>
              <button onClick={handleLimparDatas} disabled={pendingDelete}
                className="px-3 py-1 text-xs font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">
                {pendingDelete ? 'Limpando...' : 'Sim, limpar'}
              </button>
              <button onClick={() => setConfirmandoLimpeza(false)}
                className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900">
                Cancelar
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Fechar</button>
            <button onClick={handleSalvar} disabled={pendingSave}
              className="px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
              {pendingSave ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
