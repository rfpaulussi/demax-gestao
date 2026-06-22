'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { removerFalta } from '@/app/(admin)/faltas/actions'
import type { FaltaCompleta, FuncOpt, DashFaltas } from '@/app/(admin)/faltas/actions'
import { FALTA_TIPO_LABELS, FALTA_TIPO_COLORS } from './faltas-config'
import type { FaltaTipo } from './faltas-config'
import { ModalRegistrarFalta } from './modal-registrar-falta'

const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const sel   = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl border border-gray-100 border-t-4 bg-white p-3 shadow-sm ${color}`}>
      <p className="text-2xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

function RemoverBtn({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      onClick={() => start(async () => { await removerFalta(id) })}
      disabled={pending}
      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
    >
      {pending ? '...' : 'Remover'}
    </button>
  )
}

interface Props {
  dash: DashFaltas
  faltas: FaltaCompleta[]
  funcionariosOpt: FuncOpt[]
  mes: number
  ano: number
  tipoAtivo: string
  anos: number[]
}

export function FaltasClient({ dash, faltas, funcionariosOpt, mes, ano, tipoAtivo, anos }: Props) {
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  function handleFilter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const params = new URLSearchParams()
    params.set('mes', fd.get('mes') as string)
    params.set('ano', fd.get('ano') as string)
    const tipo = fd.get('tipo') as string
    if (tipo) params.set('tipo', tipo)
    router.push(`/faltas?${params.toString()}`)
  }

  return (
    <div className="space-y-6">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total Ocorrências"  value={dash.total_ocorrencias}  color="border-t-slate-500"  />
        <KpiCard label="Dias Perdidos"      value={dash.total_dias_geral}    color="border-t-red-500"    />
        <KpiCard label="Sem Justificativa"  value={dash.sem_justificativa}   color="border-t-orange-500" />
        <KpiCard label="Reincidentes (3+)"  value={dash.reincidentes}        color="border-t-purple-500" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">Ausências por Secretaria</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dash.por_secretaria} margin={{ top: 4, right: 8, left: 0, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="secretaria" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="dias_faltas"    name="Faltas"    fill="#ef4444" stackId="a" />
              <Bar dataKey="dias_atestados" name="Atestados" fill="#f97316" stackId="a" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">Evolução Mensal — últimos 6 meses</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dash.evolucao_mensal} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend verticalAlign="top" height={36} />
              <Line type="monotone" dataKey="faltas"    name="Faltas"    stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="atestados" name="Atestados" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ranking */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Top 10 — Funcionários com Mais Ausências</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                {['#', 'Funcionário', 'Secretaria', 'Ocorrências', 'Dias Totais'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {dash.top_funcionarios.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">Nenhuma ocorrência no período.</td>
                </tr>
              ) : dash.top_funcionarios.map((f, i) => (
                <tr key={i} className="hover:bg-gray-50/80">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{f.nome}</td>
                  <td className="px-4 py-2.5 text-gray-500">{f.secretaria ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                      f.ocorrencias >= 3 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    )}>
                      {f.ocorrencias}
                      {f.ocorrencias >= 3 && <span>⚠</span>}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-gray-700">{f.dias}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filtros */}
      <form onSubmit={handleFilter} className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end sm:gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Mês</label>
          <select name="mes" defaultValue={mes} className={`${sel} w-full sm:w-auto`}>
            {MESES.slice(1).map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Ano</label>
          <select name="ano" defaultValue={ano} className={`${sel} w-full sm:w-auto`}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Tipo</label>
          <select name="tipo" defaultValue={tipoAtivo} className={`${sel} w-full sm:w-auto`}>
            <option value="">Todos</option>
            {(Object.entries(FALTA_TIPO_LABELS) as [FaltaTipo, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="flex h-9 w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 sm:w-auto sm:self-end">
          Filtrar
        </button>
        <Link href="/faltas" className="flex h-9 w-full items-center justify-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50 sm:w-auto sm:self-end">
          Limpar
        </Link>
      </form>

      {/* Header tabela */}
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

      {/* Tabela */}
      {faltas.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm">
          <p className="text-sm text-gray-400">Nenhuma falta encontrada para o período.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Funcionário','Função','Posto','Secretaria','Data','Data Fim','Tipo','Dias','Registrado por','Ações'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {faltas.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-medium text-gray-900">{f.funcionarios?.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{f.funcionarios?.funcoes?.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{f.funcionarios?.postos?.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{f.funcionarios?.postos?.secretaria ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{fmt(f.data_falta)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{fmt(f.data_fim)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold', FALTA_TIPO_COLORS[f.tipo] ?? 'bg-gray-100 text-gray-600')}>
                        {FALTA_TIPO_LABELS[f.tipo] ?? f.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{f.dias}</td>
                    <td className="px-4 py-3 text-gray-500">{f.perfis?.nome ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <RemoverBtn id={f.id} />
                        {f.tipo === 'sem_justificativa' && (
                          <Link
                            href={`/advertencias?funcionario_id=${f.funcionario_id}`}
                            className="text-xs text-orange-600 hover:text-orange-800"
                          >
                            Gerar Advertência
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ModalRegistrarFalta
        open={showModal}
        onClose={() => setShowModal(false)}
        funcionariosOpt={funcionariosOpt}
      />
    </div>
  )
}
