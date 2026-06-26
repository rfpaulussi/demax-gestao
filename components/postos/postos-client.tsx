'use client'

import { useState, useMemo, useEffect } from 'react'
import { UserPlus, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx-js-style'
import { cn } from '@/lib/utils'
import type { PostoRow } from '@/app/(admin)/postos/actions'
import { criarPosto, editarPosto, desativarPosto } from '@/app/(admin)/postos/actions'
import { ModalNovaAdmissao } from './modal-nova-admissao'

// ─── types ────────────────────────────────────────────────────────────────────

type StatusPosto = 'ok' | 'deficit' | 'excesso' | 'vago'
type SortCol     = 'nome' | 'secretaria' | 'supervisor' | 'efetivo_atual' | 'efetivo_previsto' | 'status'
type SortDir     = 'asc' | 'desc'

// ─── helpers ──────────────────────────────────────────────────────────────────

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

const STATUS_ORDER: Record<StatusPosto, number> = {
  vago: 0, deficit: 1, ok: 2, excesso: 3,
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function CounterCard({
  label,
  value,
  topColor,
  subtext,
  subtextClass = 'text-gray-500',
  subtext2,
  subtext2Class = 'text-gray-400',
}: {
  label: string
  value: number
  topColor: string
  subtext?: string
  subtextClass?: string
  subtext2?: string
  subtext2Class?: string
}) {
  return (
    <div className={`rounded-xl border border-gray-100 border-t-4 bg-white p-3 shadow-sm ${topColor}`}>
      <p className="text-2xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      {subtext && <p className={`mt-1 text-sm ${subtextClass}`}>{subtext}</p>}
      {subtext2 && <p className={`text-xs ${subtext2Class}`}>{subtext2}</p>}
    </div>
  )
}

// ─── column definitions ───────────────────────────────────────────────────────

type ColDef = { label: string; sortKey: SortCol | null; align: 'left' | 'center' }

const COLS: ColDef[] = [
  { label: 'Posto',              sortKey: 'nome',             align: 'left'   },
  { label: 'Secretaria',         sortKey: 'secretaria',       align: 'left'   },
  { label: 'Supervisor',         sortKey: 'supervisor',       align: 'left'   },
  { label: 'Aloc / Prev',        sortKey: 'efetivo_atual',    align: 'center' },
  { label: 'Insalub / Cota',     sortKey: null,               align: 'center' },
  { label: 'Status',             sortKey: 'status',           align: 'center' },
]

const selectClass =
  'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-sm text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

// ─── Excel export ─────────────────────────────────────────────────────────────

function exportExcelPostos(postos: PostoRow[]) {
  const wb = XLSX.utils.book_new()

  const HEADERS = ['Posto', 'Secretaria', 'Supervisor', 'Previsto', 'Atual', 'Status', 'Diferença']
  const NC = HEADERS.length

  const rows: { data: (string | number)[]; style?: 'header' | 'totals' }[] = [
    { data: ['Controle de Postos'] },
    { data: [] },
    { data: HEADERS, style: 'header' },
  ]

  const sorted = [...postos].sort((a, b) =>
    a.secretaria.localeCompare(b.secretaria) || a.nome.localeCompare(b.nome)
  )

  for (const p of sorted) {
    const status = getStatusPosto(p.efetivo_atual, p.efetivo_previsto)
    const labelStatus =
      status === 'vago'    ? 'Vago' :
      status === 'deficit' ? 'Déficit' :
      status === 'excesso' ? 'Excesso' : 'OK'
    const diferenca = p.efetivo_atual - p.efetivo_previsto

    rows.push({ data: [
      p.nome,
      p.secretaria ?? '—',
      p.supervisor_nome ?? '—',
      p.efetivo_previsto,
      p.efetivo_atual,
      labelStatus,
      diferenca,
    ]})
  }

  rows.push({ data: [
    'TOTAL', '', '',
    postos.reduce((s, p) => s + p.efetivo_previsto, 0),
    postos.reduce((s, p) => s + p.efetivo_atual, 0),
    '', '',
  ], style: 'totals' })

  const aoa = rows.map(r => r.data)
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  rows.forEach((row, ri) => {
    if (!row.style) return
    for (let ci = 0; ci < NC; ci++) {
      const addr = XLSX.utils.encode_cell({ r: ri, c: ci })
      if (!ws[addr]) ws[addr] = { v: '', t: 's' }
      if (row.style === 'header') {
        ws[addr].s = {
          font: { bold: true, color: { rgb: '475569' } },
          fill: { patternType: 'solid', fgColor: { rgb: 'e2e8f0' } },
        }
      } else if (row.style === 'totals') {
        ws[addr].s = {
          font: { bold: true },
          fill: { patternType: 'solid', fgColor: { rgb: 'f1f5f9' } },
        }
      }
    }
  })

  ws['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }]

  XLSX.utils.book_append_sheet(wb, ws, 'Postos')
  XLSX.writeFile(wb, `postos-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ─── component ────────────────────────────────────────────────────────────────

interface PostosClientProps {
  postos: PostoRow[]
  role?: string
  funcoes?: { id: string; nome: string; postoFiltro: 'apenas_sms' | 'todos' | 'sem_sms' }[]
  supervisorPostos?: { id: string; nome: string; secretaria: string | null }[]
}

export function PostosClient({ postos, role, funcoes = [], supervisorPostos = [] }: PostosClientProps) {
  const [busca, setBusca]                   = useState('')
  const [secretaria, setSecretaria]         = useState('')
  const [supervisor, setSupervisor]         = useState('')
  const [status, setStatus]                 = useState('')
  const [sortCol, setSortCol]               = useState<SortCol>('secretaria')
  const [sortDir, setSortDir]               = useState<SortDir>('asc')
  const [novaAdmissaoOpen, setNovaAdmissaoOpen] = useState(false)
  const [toast, setToast]                   = useState(false)
  const [loadingXlsx, setLoadingXlsx]       = useState(false)
  const [aba, setAba]                        = useState<'visao' | 'gerenciar'>('visao')
  const [modalPosto, setModalPosto]          = useState<'criar' | PostoRow | null>(null)
  const [confirmDesativar, setConfirmDesativar] = useState<PostoRow | null>(null)
  const [saving, setSaving]                  = useState(false)
  const [erroModal, setErroModal]            = useState('')
  const [formNome, setFormNome]              = useState('')
  const [formSecretaria, setFormSecretaria]  = useState('')
  const [formPrevisto, setFormPrevisto]      = useState(1)
  const [formInsalubridade, setFormInsalubridade] = useState(0)
  const [gerenciarSortCol, setGerenciarSortCol] = useState<'nome' | 'secretaria' | 'efetivo_previsto' | 'cota_insalubridade'>('secretaria')
  const [gerenciarSortDir, setGerenciarSortDir] = useState<'asc' | 'desc'>('asc')

  async function handleExcel() {
    setLoadingXlsx(true)
    try { exportExcelPostos(filtered) } finally { setLoadingXlsx(false) }
  }

  function abrirCriar() {
    setFormNome(''); setFormSecretaria(''); setFormPrevisto(1); setFormInsalubridade(0)
    setErroModal(''); setModalPosto('criar')
  }

  function abrirEditar(p: PostoRow) {
    setFormNome(p.nome); setFormSecretaria(p.secretaria ?? '')
    setFormPrevisto(p.efetivo_previsto); setFormInsalubridade(p.cota_insalubridade ?? 0)
    setErroModal(''); setModalPosto(p)
  }

  async function handleSalvar() {
    if (!formNome.trim() || !formSecretaria.trim()) { setErroModal('Nome e secretaria são obrigatórios'); return }
    setSaving(true); setErroModal('')
    const payload = { nome: formNome, secretaria: formSecretaria, efetivo_previsto: formPrevisto, cota_insalubridade: formInsalubridade }
    const res = modalPosto === 'criar'
      ? await criarPosto(payload)
      : await editarPosto((modalPosto as PostoRow).id, payload)
    setSaving(false)
    if (res.error) { setErroModal(res.error); return }
    setModalPosto(null)
  }

  async function handleDesativar() {
    if (!confirmDesativar) return
    setSaving(true)
    await desativarPosto(confirmDesativar.id)
    setSaving(false); setConfirmDesativar(null)
  }

  function toggleGerenciarSort(col: typeof gerenciarSortCol) {
    if (col === gerenciarSortCol) setGerenciarSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setGerenciarSortCol(col); setGerenciarSortDir('asc') }
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(false), 3500)
    return () => clearTimeout(t)
  }, [toast])

  // ── filter options ─────────────────────────────────────────────────────────

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

  // ── KPIs (always computed over full postos list) ───────────────────────────

  const kpis = useMemo(() => {
    let total = 0, ok = 0, deficit = 0, vagos = 0, excesso = 0, semSupervisor = 0
    let pessoasDeficit = 0, pessoasExcesso = 0, pessoasExcessoAfastados = 0
    for (const p of postos) {
      total++
      const st = getStatusPosto(p.efetivo_atual, p.efetivo_previsto)
      if (st === 'ok')      ok++
      if (st === 'deficit') { deficit++;  pessoasDeficit  += p.efetivo_previsto - p.efetivo_atual }
      if (st === 'vago')    vagos++
      if (st === 'excesso') {
        excesso++
        const extra = p.efetivo_atual - p.efetivo_previsto
        pessoasExcesso += extra
        if (p.secretaria === 'AFASTADOS') pessoasExcessoAfastados += extra
      }
      if (!p.supervisor_nome) semSupervisor++
    }
    return { total, ok, deficit, vagos, excesso, semSupervisor, pessoasDeficit, pessoasExcesso, pessoasExcessoAfastados }
  }, [postos])

  // ── filter ─────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = postos
    if (busca) list = list.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()))
    if (secretaria) list = list.filter(p => p.secretaria === secretaria)
    if (supervisor === 'sem_supervisor') list = list.filter(p => !p.supervisor_nome)
    else if (supervisor) list = list.filter(p => p.supervisor_nome === supervisor)
    if (status) list = list.filter(p => getStatusPosto(p.efetivo_atual, p.efetivo_previsto) === status)
    return list
  }, [postos, busca, secretaria, supervisor, status])

  // ── sort ───────────────────────────────────────────────────────────────────

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const aAfastado = a.secretaria === 'AFASTADOS' ? 1 : 0
      const bAfastado = b.secretaria === 'AFASTADOS' ? 1 : 0
      if (aAfastado !== bAfastado) return aAfastado - bAfastado
      switch (sortCol) {
        case 'nome':
          return dir * a.nome.localeCompare(b.nome, undefined, { sensitivity: 'base' })
        case 'secretaria':
          return dir * a.secretaria.localeCompare(b.secretaria, undefined, { sensitivity: 'base' })
        case 'supervisor': {
          if (!a.supervisor_nome && !b.supervisor_nome) return 0
          if (!a.supervisor_nome) return 1
          if (!b.supervisor_nome) return -1
          return dir * a.supervisor_nome.localeCompare(b.supervisor_nome, undefined, { sensitivity: 'base' })
        }
        case 'efetivo_atual':
          return dir * (a.efetivo_atual - b.efetivo_atual)
        case 'efetivo_previsto':
          return dir * (a.efetivo_previsto - b.efetivo_previsto)
        case 'status': {
          const sa = STATUS_ORDER[getStatusPosto(a.efetivo_atual, a.efetivo_previsto)]
          const sb = STATUS_ORDER[getStatusPosto(b.efetivo_atual, b.efetivo_previsto)]
          return dir * (sa - sb)
        }
        default:
          return 0
      }
    })
  }, [filtered, sortCol, sortDir])

  const postosGerenciar = useMemo(() => {
    const dir = gerenciarSortDir === 'asc' ? 1 : -1
    return [...postos].sort((a, b) => {
      switch (gerenciarSortCol) {
        case 'nome':
          return dir * a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
        case 'secretaria':
          return dir * (a.secretaria ?? '').localeCompare(b.secretaria ?? '', 'pt-BR', { sensitivity: 'base' })
        case 'efetivo_previsto':
          return dir * (a.efetivo_previsto - b.efetivo_previsto)
        case 'cota_insalubridade':
          return dir * ((a.cota_insalubridade ?? 0) - (b.cota_insalubridade ?? 0))
        default:
          return 0
      }
    })
  }, [postos, gerenciarSortCol, gerenciarSortDir])

  function handleSort(col: SortCol) {
    if (col === sortCol) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('asc') }
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Barra de abas */}
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 w-fit">
        <button type="button" onClick={() => setAba('visao')}
          className={cn('rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            aba === 'visao' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          )}>Visão Geral</button>
        {role !== 'supervisor' && (
          <button type="button" onClick={() => setAba('gerenciar')}
            className={cn('rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              aba === 'gerenciar' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            )}>Gerenciar</button>
        )}
      </div>

      {aba === 'visao' && (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <CounterCard label="Total"          value={kpis.total}         topColor="border-t-gray-400"   />
            <CounterCard label="Ok"             value={kpis.ok}            topColor="border-t-green-500"  />
            <CounterCard
              label="Déficit"
              value={kpis.deficit}
              topColor="border-t-red-500"
              subtext={kpis.pessoasDeficit > 0 ? `-${kpis.pessoasDeficit} pessoas` : undefined}
              subtextClass="text-red-500"
            />
            <CounterCard label="Vagos"          value={kpis.vagos}         topColor="border-t-gray-400"   />
            <CounterCard
              label="Excesso"
              value={kpis.excesso}
              topColor="border-t-indigo-500"
              subtext={kpis.pessoasExcesso > 0 ? `+${kpis.pessoasExcesso} pessoas` : undefined}
              subtext2={kpis.pessoasExcessoAfastados > 0 ? `(${kpis.pessoasExcessoAfastados} afastados)` : undefined}
            />
            <CounterCard label="Sem Supervisor" value={kpis.semSupervisor} topColor="border-t-amber-500"  />
          </div>

          {/* Filtros + botão Nova Admissão (supervisor) */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            <input
              type="text"
              placeholder="Buscar posto..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className={`${selectClass} col-span-2 w-full sm:w-56`}
            />

            <select value={secretaria} onChange={e => setSecretaria(e.target.value)} className={`${selectClass} w-full sm:w-auto`}>
              <option value="">Todas as secretarias</option>
              {secretarias.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select value={supervisor} onChange={e => setSupervisor(e.target.value)} className={`${selectClass} w-full sm:w-auto`}>
              <option value="">Todos os supervisores</option>
              <option value="sem_supervisor">Sem supervisor</option>
              {supervisores.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select value={status} onChange={e => setStatus(e.target.value)} className={`${selectClass} w-full sm:w-auto`}>
              <option value="">Todos os status</option>
              <option value="ok">Ok</option>
              <option value="deficit">Déficit</option>
              <option value="excesso">Excesso</option>
              <option value="vago">Vago</option>
            </select>

            <button
              type="button"
              onClick={handleExcel}
              disabled={loadingXlsx || filtered.length === 0}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 sm:w-auto sm:justify-start"
            >
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              {loadingXlsx ? 'Gerando…' : 'Excel'}
            </button>

            {role === 'supervisor' && (
              <button
                type="button"
                onClick={() => setNovaAdmissaoOpen(true)}
                className="col-span-2 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors sm:ml-auto sm:w-auto"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Nova Admissão
              </button>
            )}
          </div>

          {/* Toast confirmação */}
          {toast && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-sm">
              <span>✓</span>
              <span>Admissão enviada para aprovação.</span>
            </div>
          )}

          {/* Tabela */}
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {COLS.map(col => (
                    <th
                      key={col.label}
                      onClick={col.sortKey ? () => handleSort(col.sortKey!) : undefined}
                      className={[
                        `px-4 py-3 ${col.align === 'center' ? 'text-center' : 'text-left'} text-xs font-semibold uppercase tracking-widest`,
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
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                      Nenhum posto encontrado
                    </td>
                  </tr>
                ) : (
                  sorted.map(p => {
                    const st = getStatusPosto(p.efetivo_atual, p.efetivo_previsto)
                    const rowBg =
                      p.secretaria === 'AFASTADOS' ? 'hover:bg-purple-50' :
                      st === 'vago'                ? 'bg-red-50' :
                      !p.supervisor_nome           ? 'bg-amber-50' :
                      'hover:bg-gray-50'
                    return (
                      <tr key={p.id} className={rowBg}>
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
                        {/* Aloc / Prev */}
                        <td className="px-4 py-3 text-center tabular-nums">
                          <span className={st === 'deficit' ? 'font-bold text-red-600' : st === 'excesso' ? 'font-bold text-indigo-600' : 'text-gray-900'}>
                            {p.efetivo_atual}
                          </span>
                          <span className="text-gray-400"> / {p.efetivo_previsto}</span>
                        </td>
                        {/* Insalub / Cota */}
                        <td className="px-4 py-3 text-center tabular-nums">
                          {p.cota_insalubridade > 0 ? (
                            <>
                              <span className={p.insalubridade_atual < p.cota_insalubridade ? 'font-bold text-red-600' : p.insalubridade_atual > p.cota_insalubridade ? 'font-bold text-indigo-600' : 'text-gray-900'}>
                                {p.insalubridade_atual}
                              </span>
                              <span className="text-gray-400"> / {p.cota_insalubridade}</span>
                            </>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        {/* Status (dois badges: alocação + insalubridade) */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {p.secretaria === 'AFASTADOS' ? (
                              <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                                Afastamentos
                              </span>
                            ) : (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[st]}`}>
                                Aloc: {STATUS_LABELS[st]}
                              </span>
                            )}
                            {p.cota_insalubridade > 0 && (() => {
                              const stI = p.insalubridade_atual < p.cota_insalubridade ? 'deficit'
                                : p.insalubridade_atual > p.cota_insalubridade ? 'excesso' : 'ok'
                              return (
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[stI]}`}>
                                  Insalub: {STATUS_LABELS[stI]}
                                </span>
                              )
                            })()}
                            {p.em_ferias > 0 && (
                              <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                                🌴 {p.em_ferias} em férias
                              </span>
                            )}
                            {p.cobertura_como_origem && (
                              <span className="inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
                                Cedeu reforço
                              </span>
                            )}
                            {p.cobertura_como_destino && (
                              <span className="inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
                                Recebendo cobertura
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {aba === 'gerenciar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              {postos.length} postos cadastrados
            </p>
            <button type="button" onClick={abrirCriar}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700">
              + Novo Posto
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th onClick={() => toggleGerenciarSort('nome')}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400 cursor-pointer select-none hover:text-gray-600">
                    Posto {gerenciarSortCol === 'nome' ? (gerenciarSortDir === 'asc' ? '↑' : '↓') : <span className="text-gray-300">↕</span>}
                  </th>
                  <th onClick={() => toggleGerenciarSort('secretaria')}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400 cursor-pointer select-none hover:text-gray-600">
                    Secretaria {gerenciarSortCol === 'secretaria' ? (gerenciarSortDir === 'asc' ? '↑' : '↓') : <span className="text-gray-300">↕</span>}
                  </th>
                  <th onClick={() => toggleGerenciarSort('efetivo_previsto')}
                    className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-gray-400 cursor-pointer select-none hover:text-gray-600">
                    Previsto {gerenciarSortCol === 'efetivo_previsto' ? (gerenciarSortDir === 'asc' ? '↑' : '↓') : <span className="text-gray-300">↕</span>}
                  </th>
                  <th onClick={() => toggleGerenciarSort('cota_insalubridade')}
                    className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-gray-400 cursor-pointer select-none hover:text-gray-600">
                    Insalubridade {gerenciarSortCol === 'cota_insalubridade' ? (gerenciarSortDir === 'asc' ? '↑' : '↓') : <span className="text-gray-300">↕</span>}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {postosGerenciar.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.nome}</td>
                    <td className="px-4 py-3 text-gray-500">{p.secretaria || '—'}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-gray-700">{p.efetivo_previsto}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-gray-700">{p.cota_insalubridade ?? 0}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button type="button" onClick={() => abrirEditar(p)}
                          className="rounded border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">
                          Editar
                        </button>
                        <button type="button" onClick={() => setConfirmDesativar(p)}
                          className="rounded border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                          Desativar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalPosto !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-base font-bold text-gray-900">
              {modalPosto === 'criar' ? 'Novo Posto' : 'Editar Posto'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">Nome</label>
                <input value={formNome} onChange={e => setFormNome(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                  placeholder="Ex: UBS VILA NOVA" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">Secretaria</label>
                <input value={formSecretaria} onChange={e => setFormSecretaria(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                  placeholder="Ex: SMS" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">Efetivo Previsto</label>
                  <input type="number" min={0} value={formPrevisto} onChange={e => setFormPrevisto(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">Cota Insalubridade</label>
                  <input type="number" min={0} value={formInsalubridade} onChange={e => setFormInsalubridade(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
              </div>
              {erroModal && <p className="text-xs text-red-600">{erroModal}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setModalPosto(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button type="button" onClick={handleSalvar} disabled={saving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDesativar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-base font-bold text-gray-900">Desativar posto?</h2>
            <p className="mb-4 text-sm text-gray-500">
              <span className="font-semibold text-gray-700">{confirmDesativar.nome}</span> será marcado como inativo. Esta ação pode ser revertida via banco de dados.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDesativar(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button type="button" onClick={handleDesativar} disabled={saving}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {saving ? '...' : 'Desativar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {role === 'supervisor' && (
        <ModalNovaAdmissao
          open={novaAdmissaoOpen}
          onClose={() => setNovaAdmissaoOpen(false)}
          onSuccess={() => setToast(true)}
          postos={supervisorPostos}
          funcoes={funcoes}
        />
      )}
    </div>
  )
}
