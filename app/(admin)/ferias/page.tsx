'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { ModalNovaFerias } from '@/components/ferias/modal-nova-ferias'
import { ModalImportarHistoricoFerias } from '@/components/ferias/modal-importar-historico-ferias'
import { ModalEditarFerias } from '@/components/ferias/modal-editar-ferias'
import {
  buscarFeriasLista,
  buscarSupervisoresParaFiltro,
  type FeriasListaItem,
  type SupervisorFiltro,
} from './actions'

// ─── Helpers de data ──────────────────────────────────────────────────────────

function hoje(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function parseDate(str: string | null): Date | null {
  if (!str) return null
  const d = new Date(str + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

function formatDate(str: string | null): string {
  if (!str) return '—'
  const d = parseDate(str)
  if (!d) return '—'
  return d.toLocaleDateString('pt-BR')
}

function diasParaVencer(limiteGozo: string | null): number | null {
  if (!limiteGozo) return null
  const limite = parseDate(limiteGozo)
  if (!limite) return null
  const diff = limite.getTime() - hoje().getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// ─── Tipos de alerta ──────────────────────────────────────────────────────────

type AlertLevel = 'vencido' | 'critico' | 'atencao' | 'ok' | 'neutro'

function getAlertLevel(item: FeriasListaItem): AlertLevel {
  // Férias já gozadas ou canceladas — neutro
  if (['concluido', 'cancelado', 'em_curso'].includes(item.status)) return 'neutro'

  const dias = diasParaVencer(item.limite_gozo)
  if (dias === null) return 'neutro'
  if (dias < 0) return 'vencido'
  if (dias <= 30) return 'critico'
  if (dias <= 60) return 'atencao'
  return 'ok'
}

// ─── Componente badge limite ──────────────────────────────────────────────────

function LimiteBadge({ item }: { item: FeriasListaItem }) {
  if (!item.limite_gozo) return <span className="text-slate-400">—</span>

  const level = getAlertLevel(item)
  const dias = diasParaVencer(item.limite_gozo)
  const dataFormatada = formatDate(item.limite_gozo)

  if (level === 'neutro') {
    return <span className="text-slate-500 text-sm">{dataFormatada}</span>
  }

  if (level === 'vencido') {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-red-700">{dataFormatada}</span>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-red-600 rounded px-1.5 py-0.5 w-fit">
          🔴 VENCIDO há {Math.abs(dias!)}d
        </span>
      </div>
    )
  }

  if (level === 'critico') {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-orange-700">{dataFormatada}</span>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-orange-500 rounded px-1.5 py-0.5 w-fit">
          ⚠️ {dias}d restantes
        </span>
      </div>
    )
  }

  if (level === 'atencao') {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-amber-700">{dataFormatada}</span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5 w-fit">
          ⏰ {dias}d restantes
        </span>
      </div>
    )
  }

  // ok
  return <span className="text-sm text-slate-600">{dataFormatada}</span>
}

// ─── Cor de linha por alerta ──────────────────────────────────────────────────

function rowBg(item: FeriasListaItem): string {
  const level = getAlertLevel(item)
  if (level === 'vencido') return 'bg-red-50 hover:bg-red-100'
  if (level === 'critico') return 'bg-orange-50 hover:bg-orange-100'
  if (level === 'atencao') return 'bg-amber-50 hover:bg-amber-100'
  return 'bg-white hover:bg-slate-50'
}

// ─── Badge status ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    disponivel: 'bg-slate-100 text-slate-600',
    agendado: 'bg-blue-100 text-blue-700',
    aprovado: 'bg-indigo-100 text-indigo-700',
    em_curso: 'bg-green-100 text-green-700',
    concluido: 'bg-green-200 text-green-800',
    cancelado: 'bg-red-100 text-red-600',
  }
  const label: Record<string, string> = {
    disponivel: 'Disponível',
    agendado: 'Agendado',
    aprovado: 'Aprovado',
    em_curso: 'Em Curso',
    concluido: 'Concluído',
    cancelado: 'Cancelado',
  }
  const cls = map[status] ?? 'bg-slate-100 text-slate-600'
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label[status] ?? status}
    </span>
  )
}

// ─── Tipo ordenação ───────────────────────────────────────────────────────────

type SortKey =
  | 'funcionario_nome'
  | 'posto_nome'
  | 'secretaria'
  | 'supervisor_nome'
  | 'numero_periodo'
  | 'limite_gozo'
  | 'data_inicio'
  | 'data_fim'
  | 'dias_direito'
  | 'status'

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FeriasPage() {
  const [ferias, setFerias] = useState<FeriasListaItem[]>([])
  const [supervisores, setSupervisores] = useState<SupervisorFiltro[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false)
  const [itemEditando, setItemEditando] = useState<FeriasListaItem | null>(null)
  const [filtroBusca, setFiltroBusca] = useState('')

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroSecretaria, setFiltroSecretaria] = useState('todas')
  const [filtroSupervisor, setFiltroSupervisor] = useState('todos')
  const [filtroVencimento, setFiltroVencimento] = useState('todos')

  // Ordenação
  const [sortKey, setSortKey] = useState<SortKey>('funcionario_nome')
  const [sortAsc, setSortAsc] = useState(true)

  useEffect(() => {
    Promise.all([buscarFeriasLista(), buscarSupervisoresParaFiltro()]).then(
      ([f, s]) => {
        setFerias(f)
        setSupervisores(s)
        setLoading(false)
      }
    )
  }, [])

  // Secretarias únicas
  const secretarias = useMemo(
    () => Array.from(new Set(ferias.map(f => f.secretaria).filter(Boolean))).sort(),
    [ferias]
  )

  // Contadores KPI
  const total = ferias.length
  const agendadas = ferias.filter(f => f.status === 'agendado').length
  const emCurso = ferias.filter(f => f.status === 'em_curso').length
  const concluidas = ferias.filter(f => f.status === 'concluido').length
  const vencidas = ferias.filter(f => getAlertLevel(f) === 'vencido').length
  const criticas = ferias.filter(f => getAlertLevel(f) === 'critico').length

  // Filtro + ordenação
  const filtered = useMemo(() => {
    let list = [...ferias]

    if (filtroBusca.trim()) {
      const termo = filtroBusca.toLowerCase().trim()
      list = list.filter(f =>
        f.funcionario_nome.toLowerCase().includes(termo) ||
        f.funcionario_registro.toLowerCase().includes(termo)
      )
    }

    if (filtroStatus !== 'todos') list = list.filter(f => f.status === filtroStatus)
    if (filtroSecretaria !== 'todas') list = list.filter(f => f.secretaria === filtroSecretaria)
    if (filtroSupervisor !== 'todos') list = list.filter(f => f.supervisor_nome === filtroSupervisor)

    if (filtroVencimento !== 'todos') {
      list = list.filter(f => {
        const level = getAlertLevel(f)
        if (filtroVencimento === 'vencido') return level === 'vencido'
        if (filtroVencimento === '30d') return level === 'critico'
        if (filtroVencimento === '60d') return level === 'atencao' || level === 'critico'
        return true
      })
    }

    const normalize = (v: string | number | null | undefined): string => {
      if (v == null) return ''
      if (typeof v === 'number') return String(v).padStart(12, '0')
      return v.toLowerCase()
    }
    list.sort((a, b) => {
      const av = normalize(a[sortKey])
      const bv = normalize(b[sortKey])
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
    })

    return list
  }, [ferias, filtroBusca, filtroStatus, filtroSecretaria, filtroSupervisor, filtroVencimento, sortKey, sortAsc])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(p => !p)
    else { setSortKey(key); setSortAsc(true) }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="text-slate-300 ml-1">↕</span>
    return <span className="text-slate-700 ml-1">{sortAsc ? '↑' : '↓'}</span>
  }

  function Th({ label, k }: { label: string; k: SortKey }) {
    return (
      <th
        className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500 cursor-pointer select-none whitespace-nowrap"
        onClick={() => handleSort(k)}
      >
        {label}<SortIcon k={k} />
      </th>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Férias</h1>
          <p className="text-sm text-slate-500">Gestão de férias do quadro de funcionários</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/ferias/relatorio"
            className="px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
          >
            ✦ Relação por Supervisor
          </Link>
          <button
            type="button"
            onClick={() => setModalHistoricoAberto(true)}
            className="px-4 py-2 text-sm font-medium bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
          >
            ↩ Importar Histórico
          </button>
          <button
            onClick={() => setModalAberto(true)}
            className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition"
          >
            + Nova Férias
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="TOTAL" value={total} color="border-blue-500" />
        <KpiCard label="AGENDADAS" value={agendadas} color="border-amber-400" />
        <KpiCard label="EM CURSO" value={emCurso} color="border-green-500" />
        <KpiCard label="CONCLUÍDAS" value={concluidas} color="border-slate-400" />
        <KpiCard label="VENCIDAS" value={vencidas} color="border-red-500" textColor="text-red-600" />
        <KpiCard label="VENCEM EM 30D" value={criticas} color="border-orange-400" textColor="text-orange-600" />
      </div>

      {/* Alertas de vencimento em destaque */}
      {(vencidas > 0 || criticas > 0) && (
        <div className="flex flex-wrap gap-3">
          {vencidas > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 font-medium">
              🔴 <strong>{vencidas}</strong> período{vencidas > 1 ? 's' : ''} com prazo vencido — ação imediata necessária
            </div>
          )}
          {criticas > 0 && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 text-sm text-orange-700 font-medium">
              ⚠️ <strong>{criticas}</strong> período{criticas > 1 ? 's' : ''} vencem em até 30 dias
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
        <input
          type="text"
          value={filtroBusca}
          onChange={e => setFiltroBusca(e.target.value)}
          placeholder="Buscar por nome ou registro..."
          className="col-span-2 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 sm:min-w-[220px] sm:w-auto"
        />

        {/* Status */}
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 sm:w-auto"
        >
          <option value="todos">Todos os status</option>
          <option value="disponivel">Disponível</option>
          <option value="agendado">Agendado</option>
          <option value="aprovado">Aprovado</option>
          <option value="em_curso">Em Curso</option>
          <option value="concluido">Concluído</option>
          <option value="cancelado">Cancelado</option>
        </select>

        {/* Secretaria */}
        <select
          value={filtroSecretaria}
          onChange={e => setFiltroSecretaria(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 sm:w-auto"
        >
          <option value="todas">Todas as secretarias</option>
          {secretarias.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Supervisor */}
        <select
          value={filtroSupervisor}
          onChange={e => setFiltroSupervisor(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 sm:w-auto"
        >
          <option value="todos">Todos os supervisores</option>
          {supervisores.map(s => <option key={s.nome} value={s.nome}>{s.nome}</option>)}
        </select>

        {/* Vencimento — filtro rápido */}
        <select
          value={filtroVencimento}
          onChange={e => setFiltroVencimento(e.target.value)}
          className="col-span-2 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 font-medium sm:col-span-1 sm:w-auto"
          style={{
            color: filtroVencimento === 'vencido' ? '#dc2626'
              : filtroVencimento === '30d' ? '#ea580c'
              : filtroVencimento === '60d' ? '#d97706'
              : '#374151'
          }}
        >
          <option value="todos">Todos os prazos</option>
          <option value="vencido">🔴 Vencidos</option>
          <option value="30d">⚠️ Vencem em 30 dias</option>
          <option value="60d">⏰ Vencem em 60 dias</option>
        </select>

        <span className="col-span-2 text-sm text-slate-400 sm:col-span-1 sm:ml-1">{filtered.length} registros</span>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <Th label="Funcionário" k="funcionario_nome" />
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">Situação</th>
                <Th label="Posto" k="posto_nome" />
                <Th label="Secretaria" k="secretaria" />
                <Th label="Supervisor" k="supervisor_nome" />
                <Th label="Período" k="numero_periodo" />
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">
                  Período Aquisitivo
                </th>
                <Th label="Dias" k="dias_direito" />
                <Th label="Limite Gozo" k="limite_gozo" />
                <Th label="Início" k="data_inicio" />
                <Th label="Fim" k="data_fim" />
                <Th label="Status" k="status" />
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-slate-400">
                    Nenhum registro encontrado
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className={`transition-colors ${rowBg(item)}`}>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-800">{item.funcionario_nome}</div>
                      <div className="text-xs text-slate-400">{item.funcionario_registro}</div>
                    </td>
                    <td className="px-3 py-3">
                      {item.funcionario_status === 'ativo'    && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Ativo</span>}
                      {item.funcionario_status === 'afastado' && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Afastado</span>}
                      {item.funcionario_status === 'inativo'  && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Inativo</span>}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{item.posto_nome}</td>
                    <td className="px-3 py-3 text-slate-600">{item.secretaria}</td>
                    <td className="px-3 py-3 text-slate-600">{item.supervisor_nome}</td>
                    <td className="px-3 py-3 text-center text-slate-600">{item.numero_periodo ?? '—'}º</td>
                    <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {item.periodo_inicio && item.periodo_fim
                        ? `${formatDate(item.periodo_inicio)} – ${formatDate(item.periodo_fim)}`
                        : '—'}
                    </td>
                    <td className="px-3 py-3 text-center font-medium text-slate-700">{item.dias_direito ?? '—'}</td>
                    <td className="px-3 py-3">
                      <LimiteBadge item={item} />
                    </td>
                    <td className="px-3 py-3 text-slate-600">{formatDate(item.data_inicio)}</td>
                    <td className="px-3 py-3 text-slate-600">{formatDate(item.data_fim)}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => setItemEditando(item)}
                        className="text-xs text-slate-500 hover:text-slate-800 underline"
                      >
                        Ver / Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <ModalNovaFerias
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        onSuccess={() => {
          buscarFeriasLista().then(setFerias)
        }}
      />
      <ModalImportarHistoricoFerias
        open={modalHistoricoAberto}
        onClose={() => setModalHistoricoAberto(false)}
        onSuccess={() => buscarFeriasLista().then(setFerias)}
      />
      <ModalEditarFerias
        key={itemEditando?.id ?? 'nenhum'}
        item={itemEditando}
        onClose={() => setItemEditando(null)}
        onSuccess={() => buscarFeriasLista().then(setFerias)}
      />
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, color, textColor,
}: {
  label: string
  value: number
  color: string
  textColor?: string
}) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-t-4 ${color}`}>
      <div className={`text-4xl font-bold ${textColor ?? 'text-slate-900'}`}>{value}</div>
      <div className="text-xs uppercase tracking-widest text-slate-400 mt-1">{label}</div>
    </div>
  )
}
