'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Search } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'afastado', label: 'Afastado' },
  { value: 'ferias', label: 'Em Férias' },
  { value: 'desligado', label: 'Desligado' },
]

export function FiltrosEfetivo({ secretarias }: { secretarias: string[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const busca = searchParams.get('busca') ?? ''
  const status = searchParams.get('status') ?? ''
  const secretaria = searchParams.get('secretaria') ?? ''

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.push(`/efetivo?${params.toString()}`)
    },
    [router, searchParams],
  )

  const inputClass =
    'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-sm text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400 placeholder:text-gray-400'

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={busca}
          onChange={e => update('busca', e.target.value)}
          className={`${inputClass} pl-9 w-full`}
        />
      </div>

      <select
        value={secretaria}
        onChange={e => update('secretaria', e.target.value)}
        className={inputClass}
      >
        <option value="">Todas as secretarias</option>
        {secretarias.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <select
        value={status}
        onChange={e => update('status', e.target.value)}
        className={inputClass}
      >
        {STATUS_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}
