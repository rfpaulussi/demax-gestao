'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { concluirFerias } from '@/app/(admin)/ferias/actions'
import { ModalNovaFerias } from './modal-nova-ferias'
import * as XLSX from 'xlsx-js-style'

export type FeriasRow = {
  id: string
  status: 'agendado' | 'aprovado' | 'em_curso' | 'concluido' | 'cancelado' | null
  data_inicio: string | null
  data_fim: string | null
  observacao: string | null
  funcionarios: {
    id: string
    nome: string
    posto_id: string | null
    postos: { nome: string; secretaria: string | null } | null
  } | null
}

const STATUS_BADGE: Record<
  NonNullable<FeriasRow['status']>,
  { label: string; className: string }
> = {
  agendado:  { label: 'Agendado',  className: 'bg-yellow-50 text-yellow-700 ring-yellow-200' },
  aprovado:  { label: 'Aprovado',  className: 'bg-blue-50 text-blue-700 ring-blue-200'       },
  em_curso: { label: 'Em Curso', className: 'bg-blue-50 text-blue-700 ring-blue-200'       },
  concluido: { label: 'Concluído', className: 'bg-green-50 text-green-700 ring-green-200'  },
  cancelado: { label: 'Cancelado', className: 'bg-gray-50 text-gray-500 ring-gray-200'    },
}

const COLS = ['Funcionário', 'Posto', 'Secretaria', 'Data Início', 'Data Fim', 'Status', 'Ações']

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

function ConcluirButton({ ferias }: { ferias: FeriasRow }) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => { await concluirFerias(ferias.id) })
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={pending}>
      {pending ? 'Salvando...' : 'Concluir'}
    </Button>
  )
}

function exportarExcel(ferias: FeriasRow[]) {
  const rows = ferias.map(f => ({
    'Funcionário': f.funcionarios?.nome ?? '',
    'Posto': f.funcionarios?.postos?.nome ?? '',
    'Secretaria': f.funcionarios?.postos?.secretaria ?? '',
    'Data Início': fmt(f.data_inicio),
    'Data Fim': fmt(f.data_fim),
    'Status': f.status ? STATUS_BADGE[f.status]?.label ?? f.status : '',
    'Observação': f.observacao ?? '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Férias')
  XLSX.writeFile(wb, 'ferias.xlsx')
}

export function FeriasTable({ ferias }: { ferias: FeriasRow[] }) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" className="bg-amber-500 text-slate-900 hover:bg-amber-400 border-0" onClick={() => exportarExcel(ferias)}>
          Exportar Excel
        </Button>
        <Button size="sm" onClick={() => setShowModal(true)}>
          Nova Férias
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {ferias.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">
            Nenhum registro de férias encontrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  {COLS.map(h => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ferias.map(f => {
                  const badge = f.status ? STATUS_BADGE[f.status] : null
                  return (
                    <tr key={f.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        {f.funcionarios?.nome ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        {f.funcionarios?.postos?.nome ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        {f.funcionarios?.postos?.secretaria ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{fmt(f.data_inicio)}</td>
                      <td className="px-5 py-3.5 text-gray-500">{fmt(f.data_fim)}</td>
                      <td className="px-5 py-3.5">
                        {badge ? (
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                              badge.className,
                            )}
                          >
                            {badge.label}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {f.status === 'em_curso' && <ConcluirButton ferias={f} />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ModalNovaFerias open={showModal} onClose={() => setShowModal(false)} />
    </>
  )
}
