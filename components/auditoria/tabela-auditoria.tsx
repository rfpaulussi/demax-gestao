'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ModalDetalheMovimentacao } from './modal-detalhe-movimentacao'
import type { TipoSolicitacao } from '@/types'

export type MovimentacaoAuditoria = {
  id: string
  badgeLabel: string
  badgeCls: string
  createdAtFmt: string
  executor: string
  solicitante: string | null
  funcionarioNome: string
  campoLabel: string
  antes: string
  depois: string
  motivoSolicitacao: string | null
  motivoRejeicao: string | null
  observacaoAdmin: string | null
  solicitacaoTipo: TipoSolicitacao | null
  dadosAntes: Record<string, unknown> | null
  dadosDepois: Record<string, unknown> | null
}

export function TabelaAuditoria({ movs }: { movs: MovimentacaoAuditoria[] }) {
  const [selecionado, setSelecionado] = useState<MovimentacaoAuditoria | null>(null)

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {movs.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-400">Nenhum registro encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  {['Data/Hora', 'Executado por', 'Solicitado por', 'Tipo', 'Funcionário', 'Campo', 'Antes', 'Depois'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {movs.map(m => (
                  <tr
                    key={m.id}
                    onClick={() => setSelecionado(m)}
                    className="cursor-pointer transition-colors hover:bg-gray-50/60"
                  >
                    <td className="px-4 py-3 tabular-nums text-gray-500 whitespace-nowrap">{m.createdAtFmt}</td>
                    <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{m.executor}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{m.solicitante ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap', m.badgeCls)}>
                        {m.badgeLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{m.funcionarioNome}</td>
                    <td className="px-4 py-3 text-gray-500">{m.campoLabel}</td>
                    <td className="max-w-[180px] px-4 py-3 text-gray-400 truncate">{m.antes}</td>
                    <td className="max-w-[180px] px-4 py-3 text-gray-700 truncate">{m.depois}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selecionado && (
        <ModalDetalheMovimentacao mov={selecionado} onClose={() => setSelecionado(null)} />
      )}
    </>
  )
}
