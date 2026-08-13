'use client'

import { useMemo, useState } from 'react'
import { exportToExcel } from '@/lib/export-excel'
import type { Divergencia, TipoDivergencia } from '@/lib/conferencia-rh/tipos'

const TIPO_LABEL: Record<TipoDivergencia, string> = {
  so_no_rh: 'Só no RH',
  so_no_sistema: 'Só no Sistema',
  nome_diferente: 'Nome diferente',
  re_divergente: 'RE divergente',
  funcao_diferente: 'Função diferente',
  afastado_diferente: 'Status afastado diferente',
  supervisor_diferente: 'Supervisor diferente',
}

export function TabelaDivergencias({ divergencias }: { divergencias: Divergencia[] }) {
  const [filtroTipo, setFiltroTipo] = useState<TipoDivergencia | 'todos'>('todos')
  const [busca, setBusca] = useState('')

  const filtradas = useMemo(() => {
    return divergencias.filter(d => {
      if (filtroTipo !== 'todos' && !d.tipos.includes(filtroTipo)) return false
      if (busca) {
        const alvo = `${d.rh.nome ?? ''} ${d.sistema.nome ?? ''}`.toLowerCase()
        if (!alvo.includes(busca.toLowerCase())) return false
      }
      return true
    })
  }, [divergencias, filtroTipo, busca])

  function exportar() {
    exportToExcel(
      filtradas,
      [
        { label: 'Tipo(s)', value: d => d.tipos.map(t => TIPO_LABEL[t]).join(', ') },
        { label: 'Nome (RH)', value: d => d.rh.nome ?? '' },
        { label: 'Nome (Sistema)', value: d => d.sistema.nome ?? '' },
        { label: 'RE (RH)', value: d => d.rh.re ?? '' },
        { label: 'RE (Sistema)', value: d => d.sistema.re ?? '' },
        { label: 'Função (RH)', value: d => d.rh.funcao ?? '' },
        { label: 'Função (Sistema)', value: d => d.sistema.funcao ?? '' },
        { label: 'Supervisor (RH)', value: d => d.rh.supervisor ?? '' },
        { label: 'Supervisor (Sistema)', value: d => d.sistema.supervisor ?? '' },
      ],
      `conferencia-rh-divergencias-${new Date().toISOString().slice(0, 10)}.xlsx`,
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="h-9 w-56 rounded-lg border border-gray-200 px-3 text-sm"
        />
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value as TipoDivergencia | 'todos')}
          className="h-9 rounded-lg border border-gray-200 px-3 text-sm"
        >
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPO_LABEL).map(([tipo, label]) => (
            <option key={tipo} value={tipo}>{label}</option>
          ))}
        </select>
        <button
          onClick={exportar}
          className="ml-auto h-9 rounded-lg bg-amber-500 px-4 text-sm font-medium text-slate-900 hover:bg-amber-400"
        >
          Exportar Excel
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Divergência</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">RH</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Sistema</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-gray-400"></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map(d => (
              <tr key={d.chave} className="border-b border-gray-50">
                <td className="px-3 py-2 text-xs text-amber-700">
                  {d.tipos.map(t => TIPO_LABEL[t]).join(', ')}
                </td>
                <td className="px-3 py-2 text-xs text-gray-700">
                  {d.rh.nome ? `${d.rh.nome} · RE ${d.rh.re} · ${d.rh.funcao} · ${d.rh.supervisor ?? '—'}` : '—'}
                </td>
                <td className="px-3 py-2 text-xs text-gray-700">
                  {d.sistema.nome ? `${d.sistema.nome} · RE ${d.sistema.re ?? '—'} · ${d.sistema.funcao ?? '—'} · ${d.sistema.supervisor ?? '—'}` : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  {d.sistema.id && (
                    <a href={`/efetivo/${d.sistema.id}`} className="text-xs font-medium text-slate-900 underline">
                      Abrir perfil
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-xs text-gray-400">
                  Nenhuma divergência encontrada com esse filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
