'use client'

import { useRef } from 'react'
import { Search } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  ativo:     'Ativo',
  afastado:  'Afastado',
  ferias:    'Em Férias',
  desligado: 'Desligado',
}

export type FiltrosValues = {
  busca: string
  status: string
  secretaria: string
  supervisor: string
}

export type FiltrosCounts = {
  statusCounts: Record<string, number>
  secretariaCounts: Record<string, number>
  supervisorCounts: Record<string, number>
  semSupervisorCount: number
}

export function FiltrosEfetivo({
  secretarias,
  supervisores,
  counts,
  values,
  onChange,
}: {
  secretarias: string[]
  supervisores: { id: string; nome: string | null }[]
  counts: FiltrosCounts
  values: FiltrosValues
  onChange: (key: keyof FiltrosValues, value: string) => void
}) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleBusca(val: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onChange('busca', val), 200)
  }

  const inputClass =
    'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-sm text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400 placeholder:text-gray-400'

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-48 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou registro..."
          defaultValue={values.busca}
          onChange={e => handleBusca(e.target.value)}
          className={`${inputClass} w-full pl-9`}
        />
      </div>

      <select
        value={values.supervisor}
        onChange={e => onChange('supervisor', e.target.value)}
        className={inputClass}
      >
        <option value="">Todos os supervisores</option>
        <option value="sem_supervisor">
          Sem Supervisor ({counts.semSupervisorCount})
        </option>
        {supervisores.map(s => (
          <option key={s.id} value={s.id}>
            {s.nome ?? '—'} ({counts.supervisorCounts[s.id] ?? 0})
          </option>
        ))}
      </select>

      <select
        value={values.secretaria}
        onChange={e => onChange('secretaria', e.target.value)}
        className={inputClass}
      >
        <option value="">Todas as secretarias</option>
        {secretarias.map(s => (
          <option key={s} value={s}>
            {s} ({counts.secretariaCounts[s] ?? 0})
          </option>
        ))}
      </select>

      <select
        value={values.status}
        onChange={e => onChange('status', e.target.value)}
        className={inputClass}
      >
        <option value="">Todos os status</option>
        {Object.entries(STATUS_LABELS).map(([val, label]) => (
          <option key={val} value={val}>
            {label} ({counts.statusCounts[val] ?? 0})
          </option>
        ))}
      </select>
    </div>
  )
}
