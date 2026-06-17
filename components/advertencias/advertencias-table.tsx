'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { downloadAdvertenciaPDF } from './advertencia-pdf'
import { marcarEntregue, excluirAdvertencia } from '@/app/(admin)/advertencias/actions'
import { ModalEditarAdvertencia } from './modal-editar-advertencia'
import type { AdvertenciaCompleta, SupervisorOpt } from '@/app/(admin)/advertencias/actions'

const GRAU_BADGE: Record<string, { label: string; cls: string }> = {
  verbal:    { label: 'Verbal',    cls: 'bg-yellow-50 text-yellow-700 ring-yellow-200' },
  escrita:   { label: 'Escrita',   cls: 'bg-orange-50 text-orange-700 ring-orange-200' },
  suspensao: { label: 'Suspensão', cls: 'bg-red-50 text-red-700 ring-red-200'          },
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pendente: { label: 'Pendente', cls: 'bg-gray-50 text-gray-600 ring-gray-200'    },
  gerada:   { label: 'Gerada',   cls: 'bg-blue-50 text-blue-700 ring-blue-200'    },
  entregue: { label: 'Entregue', cls: 'bg-green-50 text-green-700 ring-green-200' },
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

interface Props {
  advertencias: AdvertenciaCompleta[]
  reincidencias: Record<string, number>
  supervisores: SupervisorOpt[]
}

export function AdvertenciasTable({ advertencias, reincidencias, supervisores }: Props) {
  const [loadingPdf,          setLoadingPdf]          = useState<string | null>(null)
  const [editando,            setEditando]            = useState<AdvertenciaCompleta | null>(null)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null)
  const [excluindo,           setExcluindo]           = useState(false)
  const [lista,               setLista]               = useState(advertencias)

  async function handleDownloadPDF(adv: AdvertenciaCompleta) {
    setLoadingPdf(adv.id)
    try {
      await downloadAdvertenciaPDF(adv)
    } catch (err) {
      console.error(err)
      alert('Erro ao gerar PDF. Tente novamente.')
    } finally {
      setLoadingPdf(null)
    }
  }

  async function handleExcluir(id: string) {
    setExcluindo(true)
    try {
      await excluirAdvertencia(id)
      setLista(prev => prev.filter(a => a.id !== id))
      setConfirmandoExclusao(null)
    } catch (err: unknown) {
      alert('Erro ao excluir: ' + (err instanceof Error ? err.message : 'Erro desconhecido'))
    } finally {
      setExcluindo(false)
    }
  }

  function handleSucesso() {
    window.location.reload()
  }

  if (lista.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm">
        <p className="text-sm text-gray-400">Nenhuma advertência encontrada.</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Colaborador', 'Posto', 'Secretaria', 'Grau', 'Ocorrência', 'Status', 'Reinc.', 'Ações'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lista.map(adv => {
                const reinc = reincidencias[adv.funcionario_id] ?? 1
                const isReinc = reinc > 1
                const grauKey = adv.grau ?? (adv.tipo as string) ?? ''
                const grauBadge = GRAU_BADGE[grauKey] ?? { label: grauKey || '—', cls: 'bg-gray-50 text-gray-600 ring-gray-200' }
                const statusBadge = STATUS_BADGE[adv.status ?? 'pendente'] ?? STATUS_BADGE.pendente

                return (
                  <tr key={adv.id} className={cn('transition-colors hover:bg-gray-50/80', isReinc && 'bg-red-50 hover:bg-red-100/60')}>
                    <td className={cn('px-4 py-3 font-medium text-gray-900', isReinc && 'border-l-[3px] border-l-red-400')}>
                      {adv.funcionarios?.nome ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{adv.funcionarios?.postos?.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{adv.funcionarios?.postos?.secretaria ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', grauBadge.cls)}>
                        {grauBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{fmt(adv.data_ocorrencia)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', statusBadge.cls)}>
                        {statusBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isReinc ? (
                        <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                          {reinc}ª vez
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">1ª vez</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDownloadPDF(adv)}
                          disabled={loadingPdf === adv.id}
                          className="flex h-7 items-center rounded-md bg-amber-500 px-2.5 text-xs font-semibold text-slate-900 transition-colors hover:bg-amber-400 disabled:opacity-50"
                        >
                          {loadingPdf === adv.id ? '...' : 'PDF'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditando(adv)}
                          className="flex h-7 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmandoExclusao(adv.id)}
                          className="flex h-7 items-center rounded-md border border-red-200 bg-red-50 px-2.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                        >
                          Excluir
                        </button>
                        {adv.status === 'gerada' && (
                          <form action={marcarEntregue}>
                            <input type="hidden" name="advertencia_id" value={adv.id} />
                            <button type="submit"
                              className="flex h-7 items-center rounded-md border border-green-200 bg-green-50 px-2.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100">
                              Entregar
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de edição */}
      <ModalEditarAdvertencia
        adv={editando}
        supervisores={supervisores}
        onClose={() => setEditando(null)}
        onSuccess={handleSucesso}
      />

      {/* Confirmação de exclusão */}
      {confirmandoExclusao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Excluir Advertência</h3>
            <p className="text-sm text-gray-500 mb-6">
              Tem certeza que deseja excluir esta advertência? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmandoExclusao(null)}
                className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleExcluir(confirmandoExclusao)}
                disabled={excluindo}
                className="flex h-9 items-center rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {excluindo ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
