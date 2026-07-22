'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { removerFalta } from '@/app/(admin)/faltas/actions'
import type { FaltaCompleta, FuncOpt, DashFaltas } from '@/app/(admin)/faltas/actions'
import { exportToExcel } from '@/lib/export-excel'
import { FALTA_TIPO_LABELS, FALTA_TIPO_COLORS } from './faltas-config'
import type { FaltaTipo } from './faltas-config'
import { ModalRegistrarFalta } from './modal-registrar-falta'
import { ModalEditarFalta } from './modal-editar-falta'
import { ConfirmarExclusaoDialog } from '@/components/ui/confirmar-exclusao-dialog'

const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const sel   = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function KpiCard({
  label,
  value,
  sub,
  color,
  valueColor,
}: {
  label: string
  value: number
  sub?: string
  color: string
  valueColor?: string
}) {
  return (
    <div className={`rounded-xl border border-gray-100 border-t-4 bg-white p-4 shadow-sm ${color}`}>
      <p className={`text-3xl font-bold tracking-tight ${valueColor ?? 'text-gray-900'}`}>
        {value === 0 && label === 'Sem Justificativa' ? '—' : value}
      </p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

function RemoverBtn({ id, nome }: { id: string; nome?: string | null }) {
  const [confirmando, setConfirmando] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-xs text-red-500 hover:text-red-700"
      >
        Remover
      </button>
      {confirmando && (
        <ConfirmarExclusaoDialog
          open
          onOpenChange={setConfirmando}
          titulo={`Remover falta${nome ? ` de ${nome}` : ''}?`}
          onConfirmar={() => removerFalta(id)}
        />
      )}
    </>
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
  periodo: number
}

const FALTA_TIPO_EXCEL: Record<string, string> = {
  sem_justificativa: 'Sem Justificativa',
  atestado:          'Atestado Médico',
  declaracao:        'Declaração',
  licenca:           'Licença',
  outro:             'Outro',
}

function exportFaltasExcel(faltas: FaltaCompleta[], mes: number, ano: number) {
  const nomeMes = MESES[mes]
  exportToExcel(
    faltas,
    [
      { label: 'Funcionário',    value: r => r.funcionarios?.nome ?? '' },
      { label: 'Função',         value: r => r.funcionarios?.funcoes?.nome ?? '' },
      { label: 'Posto',          value: r => r.funcionarios?.postos?.nome ?? '' },
      { label: 'Secretaria',     value: r => r.funcionarios?.postos?.secretaria ?? '' },
      { label: 'Data Início',    value: r => fmt(r.data_falta) },
      { label: 'Data Fim',       value: r => fmt(r.data_fim) },
      { label: 'Tipo',           value: r => FALTA_TIPO_EXCEL[r.tipo] ?? r.tipo },
      { label: 'Dias',           value: r => r.dias },
      { label: 'Registrado por', value: r => r.perfis?.nome ?? '' },
      { label: 'Observação',     value: r => r.observacao ?? '' },
    ],
    `faltas_${nomeMes}_${ano}.xlsx`,
  )
}

export function FaltasClient({ dash, faltas, funcionariosOpt, mes, ano, tipoAtivo, anos, periodo }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<FaltaCompleta | null>(null)
  const [busca, setBusca] = useState('')
  const router = useRouter()

  const faltasFiltradas = useMemo(() => {
    if (!busca.trim()) return faltas
    const q = busca.toLowerCase()
    return faltas.filter(f => f.funcionarios?.nome?.toLowerCase().includes(q))
  }, [faltas, busca])

  function handleFilter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const params = new URLSearchParams()
    params.set('mes', fd.get('mes') as string)
    params.set('ano', fd.get('ano') as string)
    const tipo = fd.get('tipo') as string
    if (tipo) params.set('tipo', tipo)
    const per = fd.get('periodo') as string
    if (per && per !== '1') params.set('periodo', per)
    router.push(`/faltas?${params.toString()}`)
  }

  return (
    <div className="space-y-6">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total Ocorrências" value={dash.total_ocorrencias} sub="faltas + atestados"   color="border-t-red-400"    />
        <KpiCard label="Dias Perdidos"     value={dash.total_dias_geral}  sub="no mês"               color="border-t-amber-400"  />
        <KpiCard label="Sem Justificativa" value={dash.sem_justificativa} sub={dash.sem_justificativa === 0 ? '0 ocorrências' : `${dash.sem_justificativa} registro${dash.sem_justificativa > 1 ? 's' : ''}`} color="border-t-blue-400" />
        <KpiCard label="Reincidentes (3+)" value={dash.reincidentes}      sub={dash.reincidentes > 0 ? 'requer atenção' : 'nenhum no período'} color="border-t-orange-400" valueColor={dash.reincidentes > 0 ? 'text-orange-600' : undefined} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">Ausências por Secretaria</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dash.por_secretaria} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="secretaria" tick={{ fontSize: 12 }} width={70} />
              <Tooltip />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="dias_atestados" name="Atestados" fill="#f97316" stackId="a" />
              <Bar dataKey="dias_faltas"    name="Faltas"    fill="#ef4444" stackId="a" radius={[0, 3, 3, 0]} />
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
        {dash.top_funcionarios.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">Nenhuma ocorrência no período.</p>
        ) : (() => {
          const maxDias = dash.top_funcionarios[0]?.dias ?? 1
          const MEDALS = ['🥇', '🥈', '🥉']
          return (
            <div className="divide-y divide-gray-50">
              {dash.top_funcionarios.map((f, i) => {
                const pct = Math.round((f.dias / maxDias) * 100)
                const isReincidente = f.ocorrencias >= 3
                const badgeClass = f.ocorrencias >= 3
                  ? 'bg-red-100 text-red-700'
                  : f.ocorrencias === 2
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-green-100 text-green-700'
                const barColor = f.ocorrencias >= 3
                  ? 'bg-red-400'
                  : f.ocorrencias === 2
                    ? 'bg-amber-400'
                    : 'bg-green-400'
                const daysColor = f.ocorrencias >= 3
                  ? 'text-red-600'
                  : f.ocorrencias === 2
                    ? 'text-amber-600'
                    : 'text-gray-600'
                return (
                  <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/60">
                    {/* Posição */}
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm"
                      style={{ background: i === 0 ? '#FFF3CD' : i === 1 ? '#E8E8E8' : i === 2 ? '#FFE5CC' : '#F3F4F6' }}
                    >
                      {i < 3 ? MEDALS[i] : <span className="text-xs font-semibold text-gray-500">{i + 1}</span>}
                    </div>

                    {/* Nome + secretaria */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-gray-900">{f.nome}</span>
                        {isReincidente && (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                            reincidente
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{f.secretaria ?? '—'}</p>
                    </div>

                    {/* Barra + dias */}
                    <div className="w-28 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <span className={cn('text-sm font-semibold', daysColor)}>{f.dias}d</span>
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', badgeClass)}>
                          {f.ocorrencias} oc.
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Filtros */}
      <div className="space-y-3">
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
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Período</label>
            <select name="periodo" defaultValue={periodo} className={`${sel} w-full sm:w-auto`}>
              <option value={1}>1 mês</option>
              <option value={3}>3 meses</option>
              <option value={6}>6 meses</option>
              <option value={12}>12 meses</option>
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

        {/* Busca por funcionário (client-side) */}
        <div className="relative max-w-xs">
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar funcionário..."
            className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Header tabela */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {faltasFiltradas.length}{busca ? ` de ${faltas.length}` : ''} registro{faltasFiltradas.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportFaltasExcel(faltasFiltradas, mes, ano)}
            disabled={faltasFiltradas.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-40"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex h-9 items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-amber-400"
          >
            + Registrar Falta
          </button>
        </div>
      </div>

      {/* Tabela */}
      {faltasFiltradas.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm">
          <p className="text-sm text-gray-400">{busca ? 'Nenhum funcionário encontrado para a busca.' : 'Nenhuma falta encontrada para o período.'}</p>
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
                {faltasFiltradas.map(f => (
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
                        <button
                          type="button"
                          onClick={() => setEditando(f)}
                          className="text-xs text-blue-500 hover:text-blue-700"
                        >
                          Editar
                        </button>
                        <RemoverBtn id={f.id} nome={f.funcionarios?.nome} />
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

      <ModalEditarFalta
        falta={editando}
        onClose={() => setEditando(null)}
        onSuccess={() => { setEditando(null); router.refresh() }}
      />
    </div>
  )
}
