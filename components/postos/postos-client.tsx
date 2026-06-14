'use client'

import { useState, useMemo, useEffect } from 'react'
import { UserPlus } from 'lucide-react'
import type { PostoRow } from '@/app/(admin)/postos/actions'
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
}: {
  label: string
  value: number
  topColor: string
  subtext?: string
  subtextClass?: string
}) {
  return (
    <div className={`rounded-xl border border-gray-100 border-t-4 bg-white p-5 shadow-sm ${topColor}`}>
      <p className="text-4xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      {subtext && <p className={`mt-1 text-sm ${subtextClass}`}>{subtext}</p>}
    </div>
  )
}

// ─── column definitions ───────────────────────────────────────────────────────

type ColDef = { label: string; sortKey: SortCol | null; align: 'left' | 'center' }

const COLS: ColDef[] = [
  { label: 'Posto',         sortKey: 'nome',             align: 'left'   },
  { label: 'Secretaria',    sortKey: 'secretaria',       align: 'left'   },
  { label: 'Supervisor',    sortKey: 'supervisor',       align: 'left'   },
  { label: 'Alocado',       sortKey: 'efetivo_atual',    align: 'center' },
  { label: 'Previsto',      sortKey: 'efetivo_previsto', align: 'center' },
  { label: 'Insalubridade', sortKey: null,               align: 'center' },
  { label: 'Status',        sortKey: 'status',           align: 'center' },
]

const selectClass =
  'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-sm text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

// ─── component ────────────────────────────────────────────────────────────────

interface PostosClientProps {
  postos: PostoRow[]
  role?: string
  funcoes?: { id: string; nome: string; postoFiltro: 'apenas_sms' | 'todos' | 'sem_sms' }[]
  supervisorPostos?: { id: string; nome: string; secretaria: string | null }[]
}

export function PostosClient({ postos, role, funcoes = [], supervisorPostos = [] }: PostosClientProps) {
  const [secretaria, setSecretaria]         = useState('')
  const [supervisor, setSupervisor]         = useState('')
  const [status, setStatus]                 = useState('')
  const [sortCol, setSortCol]               = useState<SortCol>('secretaria')
  const [sortDir, setSortDir]               = useState<SortDir>('asc')
  const [novaAdmissaoOpen, setNovaAdmissaoOpen] = useState(false)
  const [toast, setToast]                   = useState(false)

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
    let pessoasDeficit = 0, pessoasExcesso = 0
    for (const p of postos) {
      total++
      const st = getStatusPosto(p.efetivo_atual, p.efetivo_previsto)
      if (st === 'ok')      ok++
      if (st === 'deficit') { deficit++;  pessoasDeficit  += p.efetivo_previsto - p.efetivo_atual }
      if (st === 'vago')    vagos++
      if (st === 'excesso') { excesso++;  pessoasExcesso  += p.efetivo_atual    - p.efetivo_previsto }
      if (!p.supervisor_nome) semSupervisor++
    }
    return { total, ok, deficit, vagos, excesso, semSupervisor, pessoasDeficit, pessoasExcesso }
  }, [postos])

  // ── filter ─────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = postos
    if (secretaria) list = list.filter(p => p.secretaria === secretaria)
    if (supervisor === 'sem_supervisor') list = list.filter(p => !p.supervisor_nome)
    else if (supervisor) list = list.filter(p => p.supervisor_nome === supervisor)
    if (status) list = list.filter(p => getStatusPosto(p.efetivo_atual, p.efetivo_previsto) === status)
    return list
  }, [postos, secretaria, supervisor, status])

  // ── sort ───────────────────────────────────────────────────────────────────

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
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

  function handleSort(col: SortCol) {
    if (col === sortCol) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('asc') }
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
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
        />
        <CounterCard label="Sem Supervisor" value={kpis.semSupervisor} topColor="border-t-amber-500"  />
      </div>

      {/* Filtros + botão Nova Admissão (supervisor) */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={secretaria} onChange={e => setSecretaria(e.target.value)} className={selectClass}>
          <option value="">Todas as secretarias</option>
          {secretarias.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={supervisor} onChange={e => setSupervisor(e.target.value)} className={selectClass}>
          <option value="">Todos os supervisores</option>
          <option value="sem_supervisor">Sem supervisor</option>
          {supervisores.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={status} onChange={e => setStatus(e.target.value)} className={selectClass}>
          <option value="">Todos os status</option>
          <option value="ok">Ok</option>
          <option value="deficit">Déficit</option>
          <option value="excesso">Excesso</option>
          <option value="vago">Vago</option>
        </select>

        {role === 'supervisor' && (
          <button
            type="button"
            onClick={() => setNovaAdmissaoOpen(true)}
            className="ml-auto flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
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
                  st === 'vago'        ? 'bg-red-50' :
                  !p.supervisor_nome   ? 'bg-amber-50' :
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
                    <td className="px-4 py-3 text-center tabular-nums text-gray-900">{p.efetivo_atual}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-gray-600">{p.efetivo_previsto}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-gray-600">{p.cota_insalubridade}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[st]}`}>
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
