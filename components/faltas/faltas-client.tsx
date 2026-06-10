'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { removerFalta } from '@/app/(admin)/faltas/actions'
import { ModalFalta } from './modal-falta'
import type { FaltaCompleta, FuncOpt } from '@/app/(admin)/faltas/actions'

const TIPO_BADGE: Record<string, { label: string; cls: string }> = {
  sem_justificativa: { label: 'Sem Justificativa', cls: 'bg-red-50 text-red-700 ring-red-200'        },
  declaracao:        { label: 'Declaração',        cls: 'bg-amber-50 text-amber-700 ring-amber-200'  },
  suspensao:         { label: 'Suspensão',         cls: 'bg-purple-50 text-purple-700 ring-purple-200' },
}

const sel = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function RemoverBtn({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      onClick={() => start(() => removerFalta(id))}
      disabled={pending}
      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
    >
      {pending ? '...' : 'Remover'}
    </button>
  )
}

interface Props {
  faltas: FaltaCompleta[]
  funcionariosOpt: FuncOpt[]
  mes: number
  ano: number
  tipoAtivo: string
  MESES: string[]
  anos: number[]
}

export function FaltasClient({ faltas, funcionariosOpt, mes, ano, tipoAtivo, MESES, anos }: Props) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      {/* Filters */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Mês</label>
          <select name="mes" defaultValue={mes} className={sel}>
            {MESES.slice(1).map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Ano</label>
          <select name="ano" defaultValue={ano} className={sel}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Tipo</label>
          <select name="tipo" defaultValue={tipoAtivo} className={sel}>
            <option value="">Todos</option>
            <option value="sem_justificativa">Sem Justificativa</option>
            <option value="declaracao">Declaração</option>
            <option value="suspensao">Suspensão</option>
          </select>
        </div>
        <button type="submit" className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700">
          Filtrar
        </button>
        <a href="/faltas" className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50">
          Limpar
        </a>
      </form>

      {/* Table header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {faltas.length} registro{faltas.length !== 1 ? 's' : ''}
        </p>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex h-9 items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-amber-400"
        >
          + Registrar Falta
        </button>
      </div>

      {faltas.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm">
          <p className="text-sm text-gray-400">Nenhuma falta encontrada.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Funcionário', 'Função', 'Posto', 'Secretaria', 'Data', 'Tipo', 'Dias', 'Registrado por', 'Ações'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {faltas.map(f => {
                  const badge = TIPO_BADGE[f.tipo] ?? { label: f.tipo, cls: 'bg-gray-50 text-gray-600 ring-gray-200' }
                  return (
                    <tr key={f.id} className="transition-colors hover:bg-gray-50/80">
                      <td className="px-4 py-3 font-medium text-gray-900">{f.funcionarios?.nome ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{f.funcionarios?.funcoes?.nome ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{f.funcionarios?.postos?.nome ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{f.funcionarios?.postos?.secretaria ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{fmt(f.data_falta)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', badge.cls)}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{f.dias}</td>
                      <td className="px-4 py-3 text-gray-500">{f.perfis?.nome ?? '—'}</td>
                      <td className="px-4 py-3">
                        <RemoverBtn id={f.id} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ModalFalta
        open={showModal}
        onClose={() => setShowModal(false)}
        funcionariosOpt={funcionariosOpt}
        mesAtual={mes}
        anoAtual={ano}
      />
    </>
  )
}
