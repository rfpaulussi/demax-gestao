'use client'

import { useState, useMemo } from 'react'
import type { PostoRow } from '@/app/(admin)/postos/actions'

type StatusPosto = 'ok' | 'deficit' | 'excesso' | 'vago'

function getStatusPosto(efetivo_atual: number, efetivo_previsto: number): StatusPosto {
  if (efetivo_atual === 0) return 'vago'
  if (efetivo_atual < efetivo_previsto) return 'deficit'
  if (efetivo_atual > efetivo_previsto) return 'excesso'
  return 'ok'
}

const STATUS_LABELS: Record<StatusPosto, string> = {
  ok:      'Ok',
  deficit: 'Déficit',
  excesso: 'Excesso',
  vago:    'Vago',
}

const STATUS_CHIP: Record<StatusPosto, string> = {
  ok:      'bg-green-100 text-green-700',
  deficit: 'bg-red-100 text-red-700',
  excesso: 'bg-indigo-100 text-indigo-700',
  vago:    'bg-gray-100 text-gray-500',
}

const selectClass =
  'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-sm text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

const TABLE_COLS = ['Posto', 'Secretaria', 'Supervisor', 'Alocado', 'Previsto', 'Insalubridade', 'Status']

export function PostosClient({ postos }: { postos: PostoRow[] }) {
  const [secretaria, setSecretaria] = useState('')
  const [supervisor, setSupervisor] = useState('')
  const [status, setStatus]         = useState('')

  const secretarias = useMemo(
    () => Array.from(new Set(postos.map(p => p.secretaria).filter(Boolean))).sort(),
    [postos],
  )

  const supervisores = useMemo(
    () =>
      Array.from(
        new Set(postos.map(p => p.supervisor_nome).filter((s): s is string => Boolean(s))),
      ).sort(),
    [postos],
  )

  const filtered = useMemo(() => {
    let list = postos
    if (secretaria) list = list.filter(p => p.secretaria === secretaria)
    if (supervisor === 'sem_supervisor') list = list.filter(p => !p.supervisor_nome)
    else if (supervisor) list = list.filter(p => p.supervisor_nome === supervisor)
    if (status) list = list.filter(p => getStatusPosto(p.efetivo_atual, p.efetivo_previsto) === status)
    return list
  }, [postos, secretaria, supervisor, status])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={secretaria} onChange={e => setSecretaria(e.target.value)} className={selectClass}>
          <option value="">Todas as secretarias</option>
          {secretarias.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select value={supervisor} onChange={e => setSupervisor(e.target.value)} className={selectClass}>
          <option value="">Todos os supervisores</option>
          <option value="sem_supervisor">Sem supervisor</option>
          {supervisores.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select value={status} onChange={e => setStatus(e.target.value)} className={selectClass}>
          <option value="">Todos os status</option>
          <option value="ok">Ok</option>
          <option value="deficit">Déficit</option>
          <option value="excesso">Excesso</option>
          <option value="vago">Vago</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {TABLE_COLS.map(col => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                  Nenhum posto encontrado
                </td>
              </tr>
            ) : (
              filtered.map(p => {
                const st = getStatusPosto(p.efetivo_atual, p.efetivo_previsto)
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.nome}</td>
                    <td className="px-4 py-3 text-gray-600">{p.secretaria || '—'}</td>
                    <td className="px-4 py-3">
                      {p.supervisor_nome ? (
                        <span className="text-gray-600">{p.supervisor_nome}</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Sem supervisor
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-900">{p.efetivo_atual}</td>
                    <td className="px-4 py-3 tabular-nums text-gray-600">{p.efetivo_previsto}</td>
                    <td className="px-4 py-3 tabular-nums text-gray-600">{p.cota_insalubridade}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[st]}`}
                      >
                        {STATUS_LABELS[st]}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
