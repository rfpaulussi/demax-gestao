'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

export type OpcoesFiltro = {
  supervisores: { id: string; nome: string }[]
  secretarias: string[]
  postos: { id: string; nome: string }[]
  tipos: { value: string; label: string }[]
}

const STATUS_OPCOES = [
  { value: 'pendente',  label: 'Pendentes' },
  { value: 'aprovada',  label: 'Aprovadas' },
  { value: 'rejeitada', label: 'Rejeitadas' },
  { value: 'todas',     label: 'Todas' },
]

const PERIODO_OPCOES = [
  { value: '',       label: 'Qualquer data' },
  { value: 'hoje',   label: 'Hoje' },
  { value: '7d',     label: 'Últimos 7 dias' },
  { value: '30d',    label: 'Últimos 30 dias' },
  { value: 'mes',    label: 'Este mês' },
  { value: 'custom', label: 'Personalizado…' },
]

const labelClass = 'mb-1 block text-[10px] font-semibold uppercase tracking-widest text-slate-500'
const fieldClass =
  'w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-600'

export function AprovacoesFiltros({ opcoes }: { opcoes: OpcoesFiltro }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const get = (k: string) => params.get(k) ?? ''
  const status = get('status') || 'pendente'
  const periodo = get('periodo')

  const [busca, setBusca] = useState(get('q'))
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setBusca(get('q')) }, [params]) // eslint-disable-line react-hooks/exhaustive-deps

  function atualizar(mudancas: Record<string, string>) {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(mudancas)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (mudancas.periodo !== undefined && mudancas.periodo !== 'custom') {
      next.delete('de'); next.delete('ate')
    }
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  function onBusca(v: string) {
    setBusca(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => atualizar({ q: v.trim() }), 350)
  }

  const temFiltro = ['periodo', 'de', 'ate', 'supervisor', 'secretaria', 'posto', 'tipo', 'q'].some(k => get(k))

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      {/* Status */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
          {STATUS_OPCOES.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => atualizar({ status: o.value === 'pendente' ? '' : o.value })}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold transition-colors',
                status === o.value ? 'bg-slate-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        {temFiltro && (
          <button
            type="button"
            onClick={() => router.replace(status === 'pendente' ? pathname : `${pathname}?status=${status}`, { scroll: false })}
            className="text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div className="col-span-2 md:col-span-1">
          <label className={labelClass}>Funcionário</label>
          <input
            value={busca}
            onChange={e => onBusca(e.target.value)}
            placeholder="Buscar nome…"
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass}>Período</label>
          <select value={periodo} onChange={e => atualizar({ periodo: e.target.value })} className={fieldClass}>
            {PERIODO_OPCOES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className={labelClass}>Supervisor</label>
          <select value={get('supervisor')} onChange={e => atualizar({ supervisor: e.target.value })} className={fieldClass}>
            <option value="">Todos</option>
            {opcoes.supervisores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>

        <div>
          <label className={labelClass}>Secretaria</label>
          <select value={get('secretaria')} onChange={e => atualizar({ secretaria: e.target.value })} className={fieldClass}>
            <option value="">Todas</option>
            {opcoes.secretarias.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className={labelClass}>Posto</label>
          <select value={get('posto')} onChange={e => atualizar({ posto: e.target.value })} className={fieldClass}>
            <option value="">Todos</option>
            {opcoes.postos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>

        <div>
          <label className={labelClass}>Tipo</label>
          <select value={get('tipo')} onChange={e => atualizar({ tipo: e.target.value })} className={fieldClass}>
            <option value="">Todos</option>
            {opcoes.tipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {periodo === 'custom' && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={labelClass}>De</label>
            <input type="date" value={get('de')} onChange={e => atualizar({ de: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Até</label>
            <input type="date" value={get('ate')} onChange={e => atualizar({ ate: e.target.value })} className={fieldClass} />
          </div>
        </div>
      )}
    </div>
  )
}
