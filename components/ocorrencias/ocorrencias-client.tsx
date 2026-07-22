'use client'

import { useState, useMemo, useTransition } from 'react'
import type { OcorrenciaRow, PostoSimples, SupervisorSimples } from '@/app/(admin)/ocorrencias/actions'
import { createOcorrencia, updateStatusOcorrencia, criarAlerta, resolverAlerta } from '@/app/(admin)/ocorrencias/actions'

// ─── types ────────────────────────────────────────────────────────────────────

type SortCol = 'data_ocorrencia' | 'posto_nome' | 'secretaria' | 'supervisor_nome' | 'gravidade' | 'status'
type SortDir = 'asc' | 'desc'

// ─── lookups ──────────────────────────────────────────────────────────────────

const GRAVIDADE_CHIP: Record<string, string> = {
  baixa:   'bg-gray-100 text-gray-600',
  media:   'bg-amber-100 text-amber-700',
  alta:    'bg-orange-100 text-orange-700',
  critica: 'bg-red-100 text-red-700 font-bold',
}

const GRAVIDADE_LABEL: Record<string, string> = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica',
}

const STATUS_CHIP: Record<string, string> = {
  aberta:     'bg-red-100 text-red-700',
  em_analise: 'bg-amber-100 text-amber-700',
  encerrada:  'bg-green-100 text-green-700',
  resolvido:  'bg-green-100 text-green-700',
}

const STATUS_LABEL: Record<string, string> = {
  aberta: 'Aberta', em_analise: 'Em Análise', encerrada: 'Encerrada', resolvido: 'Resolvido',
}

const GRAVIDADE_ORDER: Record<string, number> = {
  baixa: 0, media: 1, alta: 2, critica: 3,
}

const STATUS_ORDER: Record<string, number> = {
  aberta: 0, em_analise: 1, encerrada: 2, resolvido: 3,
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function CounterCard({ label, value, topColor }: { label: string; value: number; topColor: string }) {
  return (
    <div className={`rounded-xl border border-gray-100 border-t-4 bg-white p-3 shadow-sm ${topColor}`}>
      <p className="text-2xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

// ─── column definitions ───────────────────────────────────────────────────────

type ColDef = { label: string; sortKey: SortCol | null }

const COLS: ColDef[] = [
  { label: 'Data',       sortKey: 'data_ocorrencia' },
  { label: 'Posto',      sortKey: 'posto_nome'      },
  { label: 'Secretaria', sortKey: 'secretaria'      },
  { label: 'Supervisor', sortKey: 'supervisor_nome' },
  { label: 'Gravidade',  sortKey: 'gravidade'       },
  { label: 'Status',     sortKey: 'status'          },
  { label: 'Registro',   sortKey: null              },
  { label: 'Ações',      sortKey: null              },
]

const inputClass =
  'h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-sm text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

const selectClass = inputClass

// ─── component ────────────────────────────────────────────────────────────────

export function OcorrenciasClient({
  ocorrencias,
  postos,
  supervisores,
  currentUserId,
  isAdminOrCoord,
}: {
  ocorrencias: OcorrenciaRow[]
  postos: PostoSimples[]
  supervisores: SupervisorSimples[]
  currentUserId: string | null
  isAdminOrCoord: boolean
}) {
  const [filtSecretaria, setFiltSecretaria] = useState('')
  const [filtSupervisor, setFiltSupervisor] = useState('')
  const [filtGravidade,  setFiltGravidade]  = useState('')
  const [filtStatus,     setFiltStatus]     = useState('')
  const [sortCol, setSortCol]               = useState<SortCol>('data_ocorrencia')
  const [sortDir, setSortDir]               = useState<SortDir>('desc')

  const [modalOpen,       setModalOpen]       = useState(false)
  const [alertaModalOpen, setAlertaModalOpen] = useState(false)
  const [formError,       setFormError]       = useState<string | null>(null)
  const [alertaError,     setAlertaError]     = useState<string | null>(null)
  const [alertaTitulo,    setAlertaTitulo]    = useState('')
  const [alertaDescricao, setAlertaDescricao] = useState('')
  const [alertaLembrete,  setAlertaLembrete]  = useState('')

  const [isPending, startTransition] = useTransition()

  // ── Visibilidade: supervisores veem apenas seus próprios alertas ────────────

  const visiveis = useMemo(() => {
    if (isAdminOrCoord) return ocorrencias
    return ocorrencias.filter(o => {
      if (o.tipo === 'alerta') return o.supervisor_id === currentUserId
      return true
    })
  }, [ocorrencias, isAdminOrCoord, currentUserId])

  // ── filter options ─────────────────────────────────────────────────────────

  const secretarias = useMemo(
    () => Array.from(new Set(visiveis.map(o => o.secretaria).filter(Boolean))).sort(),
    [visiveis],
  )

  const supervisoresUnicos = useMemo(
    () =>
      Array.from(
        new Set(visiveis.map(o => o.supervisor_nome).filter((s): s is string => Boolean(s))),
      ).sort(),
    [visiveis],
  )

  // ── KPIs ───────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => ({
    total:         visiveis.length,
    abertas:       visiveis.filter(o => o.status === 'aberta').length,
    emAnalise:     visiveis.filter(o => o.status === 'em_analise').length,
    encerradas:    visiveis.filter(o => o.status === 'encerrada' || o.status === 'resolvido').length,
    criticasAlertas: visiveis.filter(o => o.gravidade === 'critica' || o.tipo === 'alerta').length,
  }), [visiveis])

  // ── filter ─────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = visiveis
    if (filtSecretaria) list = list.filter(o => o.secretaria === filtSecretaria)
    if (filtSupervisor) list = list.filter(o => o.supervisor_nome === filtSupervisor)
    if (filtGravidade)  list = list.filter(o => o.gravidade === filtGravidade)
    if (filtStatus)     list = list.filter(o => o.status === filtStatus)
    return list
  }, [visiveis, filtSecretaria, filtSupervisor, filtGravidade, filtStatus])

  // ── sort ───────────────────────────────────────────────────────────────────

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      switch (sortCol) {
        case 'data_ocorrencia':
          return dir * a.data_ocorrencia.localeCompare(b.data_ocorrencia)
        case 'posto_nome':
          return dir * a.posto_nome.localeCompare(b.posto_nome, undefined, { sensitivity: 'base' })
        case 'secretaria':
          return dir * a.secretaria.localeCompare(b.secretaria, undefined, { sensitivity: 'base' })
        case 'supervisor_nome': {
          if (!a.supervisor_nome && !b.supervisor_nome) return 0
          if (!a.supervisor_nome) return 1
          if (!b.supervisor_nome) return -1
          return dir * a.supervisor_nome.localeCompare(b.supervisor_nome, undefined, { sensitivity: 'base' })
        }
        case 'gravidade':
          return dir * ((GRAVIDADE_ORDER[a.gravidade] ?? 0) - (GRAVIDADE_ORDER[b.gravidade] ?? 0))
        case 'status':
          return dir * ((STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0))
        default:
          return 0
      }
    })
  }, [filtered, sortCol, sortDir])

  function handleSort(col: SortCol) {
    if (col === sortCol) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('asc') }
  }

  function handleStatusUpdate(id: string, newStatus: 'em_analise' | 'encerrada') {
    const fd = new FormData()
    fd.set('id', id)
    fd.set('status', newStatus)
    startTransition(async () => {
      const result = await updateStatusOcorrencia(fd)
      if (!result.success) alert(result.error)
    })
  }

  function handleResolverAlerta(id: string) {
    startTransition(async () => {
      const result = await resolverAlerta(id)
      if (!result.success) alert(result.error)
    })
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createOcorrencia(fd)
      if (result.success) setModalOpen(false)
      else setFormError(result.error)
    })
  }

  function handleCriarAlerta(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAlertaError(null)
    startTransition(async () => {
      const result = await criarAlerta(alertaTitulo, alertaDescricao, alertaLembrete || null)
      if (result.success) {
        setAlertaModalOpen(false)
        setAlertaTitulo(''); setAlertaDescricao(''); setAlertaLembrete('')
      } else {
        setAlertaError(result.error)
      }
    })
  }

  const today = new Date().toISOString().split('T')[0]

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <CounterCard label="Total"              value={kpis.total}           topColor="border-t-gray-400"   />
        <CounterCard label="Abertas"            value={kpis.abertas}         topColor="border-t-red-500"    />
        <CounterCard label="Em Análise"         value={kpis.emAnalise}       topColor="border-t-amber-500"  />
        <CounterCard label="Encerradas"         value={kpis.encerradas}      topColor="border-t-green-500"  />
        <CounterCard label="Críticas / Alertas" value={kpis.criticasAlertas} topColor="border-t-purple-500" />
      </div>

      {/* Filtros + botões */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filtSecretaria}
          onChange={e => setFiltSecretaria(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-sm text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
        >
          <option value="">Todas as secretarias</option>
          {secretarias.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={filtSupervisor}
          onChange={e => setFiltSupervisor(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-sm text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
        >
          <option value="">Todos os supervisores</option>
          {supervisoresUnicos.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={filtGravidade}
          onChange={e => setFiltGravidade(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-sm text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
        >
          <option value="">Todas as gravidades</option>
          <option value="baixa">Baixa</option>
          <option value="media">Média</option>
          <option value="alta">Alta</option>
          <option value="critica">Crítica</option>
        </select>

        <select
          value={filtStatus}
          onChange={e => setFiltStatus(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-sm text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
        >
          <option value="">Todos os status</option>
          <option value="aberta">Aberta</option>
          <option value="em_analise">Em Análise</option>
          <option value="encerrada">Encerrada</option>
          <option value="resolvido">Resolvido</option>
        </select>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => { setAlertaError(null); setAlertaTitulo(''); setAlertaDescricao(''); setAlertaLembrete(''); setAlertaModalOpen(true) }}
            className="h-9 rounded-lg border border-purple-200 bg-purple-50 px-4 text-xs font-semibold uppercase tracking-widest text-purple-700 hover:bg-purple-100"
          >
            🔔 Novo Alerta
          </button>
          <button
            onClick={() => { setFormError(null); setModalOpen(true) }}
            className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700"
          >
            Nova Ocorrência
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {COLS.map(col => (
                  <th
                    key={col.label}
                    onClick={col.sortKey ? () => handleSort(col.sortKey!) : undefined}
                    className={[
                      'px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest',
                      col.sortKey === sortCol ? 'text-gray-700' : 'text-gray-400',
                      col.sortKey ? 'cursor-pointer select-none hover:text-gray-600' : '',
                    ].join(' ')}
                  >
                    {col.label}
                    {col.sortKey === sortCol && (
                      <span className="ml-1 text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                    Nenhuma ocorrência encontrada
                  </td>
                </tr>
              ) : (
                sorted.map(o => {
                  const isAlerta = o.tipo === 'alerta'
                  const rowBg = isAlerta
                    ? 'bg-purple-50 hover:bg-purple-100/50'
                    : o.gravidade === 'critica' && o.status === 'aberta'
                      ? 'bg-red-50'
                      : o.gravidade === 'critica' && o.status === 'em_analise'
                        ? 'bg-amber-50'
                        : 'hover:bg-gray-50'
                  return (
                    <tr key={o.id} className={rowBg}>
                      <td className="px-4 py-3 tabular-nums text-gray-600">
                        {o.data_ocorrencia
                          ? new Date(o.data_ocorrencia + 'T12:00:00').toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {isAlerta ? (
                          <span className="flex items-center gap-1.5">
                            <span>🔔</span>
                            <span className="truncate max-w-[180px]">{o.titulo ?? o.descricao}</span>
                          </span>
                        ) : o.posto_nome}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {isAlerta ? '—' : (o.secretaria || '—')}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{o.supervisor_nome ?? '—'}</td>
                      <td className="px-4 py-3">
                        {isAlerta ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-purple-100 text-purple-700 font-semibold">
                            Alerta
                          </span>
                        ) : (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${GRAVIDADE_CHIP[o.gravidade] ?? ''}`}>
                            {GRAVIDADE_LABEL[o.gravidade] ?? o.gravidade}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[o.status] ?? ''}`}>
                          {STATUS_LABEL[o.status] ?? o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        <div>Criado: {o.criado_por_nome ?? '—'}</div>
                        {o.atualizado_por_nome && (
                          <div>
                            Alt.: {o.atualizado_por_nome}
                            {o.atualizado_em && ` · ${new Date(o.atualizado_em).toLocaleDateString('pt-BR')}`}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isAlerta && o.status === 'aberta' && (
                          <button
                            disabled={isPending}
                            onClick={() => handleResolverAlerta(o.id)}
                            className="rounded-lg bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-200 disabled:opacity-50"
                          >
                            Resolver
                          </button>
                        )}
                        {!isAlerta && o.status === 'aberta' && (
                          <button
                            disabled={isPending}
                            onClick={() => handleStatusUpdate(o.id, 'em_analise')}
                            className="rounded-lg bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                          >
                            Em Análise
                          </button>
                        )}
                        {!isAlerta && o.status === 'em_analise' && (
                          <button
                            disabled={isPending}
                            onClick={() => handleStatusUpdate(o.id, 'encerrada')}
                            className="rounded-lg bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-200 disabled:opacity-50"
                          >
                            Encerrar
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova Ocorrência */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-900">
                Nova Ocorrência
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-lg leading-none text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Posto
                </label>
                <select name="posto_id" required className={selectClass}>
                  <option value="">Selecionar posto…</option>
                  {postos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome}{p.secretaria ? ` — ${p.secretaria}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Supervisor
                </label>
                <select name="supervisor_id" className={selectClass}>
                  <option value="">Sem supervisor</option>
                  {supervisores.map(s => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Data
                  </label>
                  <input
                    type="date"
                    name="data_ocorrencia"
                    defaultValue={today}
                    required
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Gravidade
                  </label>
                  <select name="gravidade" required className={selectClass}>
                    <option value="">Selecionar…</option>
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Descrição
                </label>
                <textarea
                  name="descricao"
                  required
                  rows={3}
                  placeholder="Descreva a ocorrência…"
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                />
              </div>

              {formError && <p className="text-xs text-red-500">{formError}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-9 rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {isPending ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Novo Alerta */}
      {alertaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-900">
                🔔 Novo Alerta
              </h2>
              <button
                onClick={() => setAlertaModalOpen(false)}
                className="text-lg leading-none text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCriarAlerta} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Título
                </label>
                <input
                  type="text"
                  required
                  value={alertaTitulo}
                  onChange={e => setAlertaTitulo(e.target.value)}
                  placeholder="Título do alerta…"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Descrição
                </label>
                <textarea
                  required
                  value={alertaDescricao}
                  onChange={e => setAlertaDescricao(e.target.value)}
                  rows={3}
                  placeholder="Descreva o alerta…"
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Data Lembrete <span className="normal-case font-normal text-gray-400">(opcional)</span>
                </label>
                <input
                  type="date"
                  value={alertaLembrete}
                  onChange={e => setAlertaLembrete(e.target.value)}
                  className={inputClass}
                />
              </div>

              {alertaError && <p className="text-xs text-red-500">{alertaError}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAlertaModalOpen(false)}
                  className="h-9 rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="h-9 rounded-lg bg-purple-700 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-purple-800 disabled:opacity-50"
                >
                  {isPending ? 'Salvando…' : 'Criar Alerta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
