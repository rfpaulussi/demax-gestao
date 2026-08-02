'use client'

import { Dialog } from '@base-ui/react/dialog'
import { cn } from '@/lib/utils'
import type { MovimentacaoAuditoria } from './tabela-auditoria'

/** Modal somente leitura — não dispara nenhuma ação, apenas exibe o detalhe
 *  completo de um registro de auditoria já resolvido no servidor. */
export function ModalDetalheMovimentacao({
  mov,
  onClose,
}: {
  mov: MovimentacaoAuditoria
  onClose: () => void
}) {
  return (
    <Dialog.Root open onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', mov.badgeCls)}>
                {mov.badgeLabel}
              </span>
              <Dialog.Title className="mt-2 text-lg font-semibold text-gray-900">
                {mov.funcionarioNome}
              </Dialog.Title>
            </div>
            <span className="shrink-0 text-xs text-gray-400">{mov.createdAtFmt}</span>
          </div>

          <div className="mb-4 space-y-1 text-xs text-gray-500">
            <p>
              Executado por <span className="font-medium text-slate-700">{mov.executor}</span>
            </p>
            {mov.solicitante && (
              <p>
                Solicitado por <span className="font-medium text-slate-700">{mov.solicitante}</span>
              </p>
            )}
          </div>

          <div className="mb-4 space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-gray-500">{mov.campoLabel}</span>
              <span className="text-right font-medium text-gray-900">
                {mov.antes} → {mov.depois}
              </span>
            </div>
            {mov.camposDetalhe.map(c => (
              <div key={c.label} className="flex justify-between gap-3 text-sm">
                <span className="text-gray-500">{c.label}</span>
                <span className="text-right font-medium text-gray-900">{c.valor}</span>
              </div>
            ))}
          </div>

          {(mov.motivoSolicitacao || mov.motivoRejeicao || mov.observacaoAdmin) && (
            <div className="mb-4 space-y-2 text-sm">
              {mov.motivoSolicitacao && (
                <p><span className="text-gray-500">Motivo da solicitação:</span> {mov.motivoSolicitacao}</p>
              )}
              {mov.motivoRejeicao && (
                <p><span className="text-gray-500">Motivo da rejeição:</span> {mov.motivoRejeicao}</p>
              )}
              {mov.observacaoAdmin && (
                <p><span className="text-gray-500">Observação do admin:</span> {mov.observacaoAdmin}</p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full rounded px-4 py-2 text-center text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            Fechar
          </button>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
