'use client'

import { Dialog } from '@base-ui/react/dialog'
import { cn } from '@/lib/utils'
import { PostoImpactPanel } from '@/components/posto-impact-panel'
import { camposDaSolicitacao, fmtData, badgeDaSolicitacao } from './campos-solicitacao'
import type { SolicitacaoPendente } from './aprovacoes-list'
import type { ImpactoResult } from '@/app/(admin)/efetivo/impacto'

interface Props {
  sol: SolicitacaoPendente
  impacto?: ImpactoResult
  canApprove: boolean
  open: boolean
  onClose: () => void
  pending: boolean
  erro: string | null
  rejeitando: boolean
  motivo: string
  onMotivoChange: (v: string) => void
  onIniciarRejeicao: () => void
  onCancelarRejeicao: () => void
  onAprovar: () => void
  onRejeitar: () => void
  /** Data de admissão/desligamento corrigida pelo admin (YYYY-MM-DD), se editada. */
  dataOverride: string | null
  onDataOverrideChange: (v: string) => void
}

/** Campo editável (só admin) pra corrigir data de admissão/desligamento lançada errada,
 *  sem precisar rejeitar e pedir pro supervisor lançar de novo. */
const CAMPO_DATA_EDITAVEL: Partial<Record<string, { label: string; chave: string }>> = {
  admissao:    { label: 'Data de Admissão',   chave: 'data_admissao' },
  desligamento: { label: 'Data de Desligamento', chave: 'data_desligamento' },
}

export function ModalDetalheSolicitacao({
  sol, impacto, canApprove, open, onClose, pending, erro,
  rejeitando, motivo, onMotivoChange, onIniciarRejeicao, onCancelarRejeicao,
  onAprovar, onRejeitar, dataOverride, onDataOverrideChange,
}: Props) {
  const badge = badgeDaSolicitacao(sol.tipo, sol.dados_depois)
  const campos = camposDaSolicitacao(sol.tipo, sol.dados_antes, sol.dados_depois)
  const campoData = CAMPO_DATA_EDITAVEL[sol.tipo]
  const dataAtual = dataOverride ?? (sol.dados_depois?.[campoData?.chave ?? ''] as string | undefined)?.slice(0, 10) ?? ''

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', badge.className)}>
                {badge.label}
              </span>
              <Dialog.Title className="mt-2 text-lg font-semibold text-gray-900">
                {sol.funcionarios?.nome ?? '—'}
              </Dialog.Title>
            </div>
            <span className="shrink-0 text-xs text-gray-400">
              {sol.created_at ? fmtData(sol.created_at) : ''}
            </span>
          </div>

          <p className="mb-4 text-xs text-gray-500">
            Solicitado por <span className="font-medium text-slate-700">{sol.perfis?.nome ?? sol.perfis?.email ?? 'supervisor'}</span>
            {sol.motivo ? ` · ${sol.motivo}` : ''}
          </p>

          <div className="mb-4 space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
            {campos.filter(c => !(campoData && canApprove && c.label === campoData.label)).map(c => (
              <div key={c.label} className="flex justify-between gap-3 text-sm">
                <span className="text-gray-500">{c.label}</span>
                <span className="text-right font-medium text-gray-900">{c.valor}</span>
              </div>
            ))}
            {campoData && canApprove && (
              <div className="flex items-center justify-between gap-3 text-sm">
                <label htmlFor="data-override" className="text-gray-500">{campoData.label}</label>
                <input
                  id="data-override"
                  type="date"
                  value={dataAtual}
                  onChange={e => onDataOverrideChange(e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-right text-sm font-medium text-gray-900 focus:outline-none focus:ring-1 focus:ring-slate-600"
                />
              </div>
            )}
          </div>

          {impacto && (
            <div className="mb-4">
              <PostoImpactPanel impacto={impacto} />
            </div>
          )}

          {erro && (
            <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>
          )}

          {canApprove && (!rejeitando ? (
            <div className="flex gap-2">
              <button
                onClick={onAprovar}
                disabled={pending}
                className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                {pending ? '...' : 'Aprovar'}
              </button>
              <button
                onClick={onIniciarRejeicao}
                disabled={pending}
                className="flex-1 rounded-lg border border-red-300 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                Rejeitar
              </button>
            </div>
          ) : (
            <div className="space-y-2 border-t border-gray-100 pt-3">
              <textarea
                value={motivo}
                onChange={e => onMotivoChange(e.target.value)}
                rows={2}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-600"
                placeholder="Motivo da rejeição..."
              />
              <div className="flex gap-2">
                <button
                  onClick={onCancelarRejeicao}
                  className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={onRejeitar}
                  disabled={!motivo.trim() || pending}
                  className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {pending ? '...' : 'Confirmar'}
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded px-4 py-2 text-center text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            Fechar
          </button>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
