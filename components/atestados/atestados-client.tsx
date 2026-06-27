'use client'

import { useState, useMemo, useTransition } from 'react'
import { AlertTriangle, Download } from 'lucide-react'
import * as XLSX from 'xlsx-js-style'
import { cn } from '@/lib/utils'
import { deleteAtestado } from '@/app/(admin)/atestados/actions'
import { solicitarAfastamento } from '@/app/(admin)/efetivo/actions'
import { ModalEditarAtestado } from './modal-editar-atestado'

export type AtestadoRow = {
  id: string
  funcionario_id: string
  posto_id: string | null
  data_inicio: string
  data_fim: string
  motivo: string | null
  cid_codigo: string | null
  origem_ocupacional: string | null
  funcionario_nome: string
  posto_nome: string
  secretaria: string
  supervisor_nome: string | null
  dias: number
  acumulado: number
  alerta: boolean
  cid_desc: string
  nexo_ocupacional: boolean
  tem_cobertura: boolean
}

const ORIGEM_BADGE: Record<string, { label: string; className: string }> = {
  acidente_trabalho:  { label: 'Acidente de Trabalho', className: 'bg-red-100 text-red-700 ring-red-200'        },
  doenca_ocupacional: { label: 'Doença Ocupacional',   className: 'bg-orange-100 text-orange-700 ring-orange-200' },
}

type CidOpt = { codigo: string; descricao: string }

type SortCol =
  | 'funcionario_nome'
  | 'posto_nome'
  | 'secretaria'
  | 'data_inicio'
  | 'data_fim'
  | 'dias'
  | 'acumulado'

const COLS: { label: string; sortKey?: SortCol }[] = [
  { label: 'Funcionário', sortKey: 'funcionario_nome' },
  { label: 'Posto',       sortKey: 'posto_nome'       },
  { label: 'Secretaria',  sortKey: 'secretaria'       },
  { label: 'Supervisor'                                },
  { label: 'Início',      sortKey: 'data_inicio'      },
  { label: 'Fim',         sortKey: 'data_fim'         },
  { label: 'Dias',        sortKey: 'dias'             },
  { label: 'CID'                                       },
  { label: 'Origem'                                    },
  { label: 'Cobertura'                                 },
  { label: 'Acum. 30d',   sortKey: 'acumulado'        },
  { label: 'Ações'                                     },
]

interface Props {
  atestados: AtestadoRow[]
  cids: CidOpt[]
}

type InssModalState = {
  funcionario_id: string
  funcionario_nome: string
  data_inicio: string
  dias: number
  motivo: string
}

function exportExcel(rows: AtestadoRow[]) {
  const header = ['Funcionário', 'Posto', 'Secretaria', 'Supervisor', 'Início', 'Fim', 'Dias', 'CID', 'Descrição CID', 'Origem', 'Cobertura', 'Acum. 30d', 'Alerta INSS']
  const data = rows.map(a => [
    a.funcionario_nome,
    a.posto_nome,
    a.secretaria,
    a.supervisor_nome ?? '',
    a.data_inicio.split('-').reverse().join('/'),
    a.data_fim.split('-').reverse().join('/'),
    a.dias,
    a.cid_codigo ?? '',
    a.cid_desc ?? '',
    a.origem_ocupacional ?? '',
    a.tem_cobertura ? 'Sim' : 'Não',
    a.acumulado,
    a.alerta ? 'Sim' : 'Não',
  ])

  const ws = XLSX.utils.aoa_to_sheet([header, ...data])
  header.forEach((_, ci) => {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: ci })]
    if (cell) cell.s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0F172A' } } }
  })
  rows.forEach((a, ri) => {
    if (a.alerta) {
      header.forEach((_, ci) => {
        const cell = ws[XLSX.utils.encode_cell({ r: ri + 1, c: ci })]
        if (cell) cell.s = { fill: { fgColor: { rgb: 'FEE2E2' } } }
      })
    }
  })
  ws['!cols'] = [28, 30, 12, 18, 12, 12, 6, 8, 30, 20, 10, 10, 12].map(w => ({ wch: w }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Atestados')
  const hoje = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `atestados_${hoje}.xlsx`)
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return dt.toISOString().slice(0, 10)
}

function ModalSolicitarInss({
  state,
  onClose,
}: {
  state: InssModalState
  onClose: () => void
}) {
  const [motivo, setMotivo] = useState(state.motivo)
  const [dataInicio, setDataInicio] = useState(state.data_inicio)
  const [dias, setDias] = useState(String(state.dias))
  const [dataRetorno, setDataRetorno] = useState(
    state.data_inicio ? addDays(state.data_inicio, state.dias) : '',
  )
  const [erro, setErro] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function handleDias(val: string) {
    setDias(val)
    const n = parseInt(val)
    if (dataInicio && n > 0) setDataRetorno(addDays(dataInicio, n))
    else if (!val) setDataRetorno('')
  }

  function handleDataInicio(val: string) {
    setDataInicio(val)
    const n = parseInt(dias)
    if (val && n > 0) setDataRetorno(addDays(val, n))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const fd = new FormData()
    fd.set('funcionario_id', state.funcionario_id)
    fd.set('motivo', motivo)
    fd.set('data_inicio', dataInicio)
    fd.set('data_retorno_prevista', dataRetorno)
    fd.set('eh_medico', 'true')
    fd.set('dias', dias)
    start(async () => {
      const res = await solicitarAfastamento(fd)
      if (!res.success) { setErro(res.error); return }
      onClose()
    })
  }

  const labelCls = 'mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600'
  const inputCls = 'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-1 text-base font-semibold text-gray-900">Solicitar Afastamento INSS</h3>
        <p className="mb-4 text-sm text-gray-500">{state.funcionario_nome}</p>
        <div className="mb-4 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          Dados pré-preenchidos com base nos atestados acumulados. Revise antes de enviar.
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Motivo</label>
            <select value={motivo} onChange={e => setMotivo(e.target.value)} className={inputCls}>
              <option value="INSS - Doença">INSS — Doença</option>
              <option value="INSS - Acidente de Trabalho">INSS — Acidente de Trabalho</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Data de Início</label>
              <input type="date" required value={dataInicio} onChange={e => handleDataInicio(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Dias de Atestado</label>
              <input type="number" min="1" value={dias} onChange={e => handleDias(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Retorno Previsto</label>
            <input type="date" value={dataRetorno} onChange={e => { setDataRetorno(e.target.value); setDias('') }} className={inputCls} />
          </div>
          {erro && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={pending} className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={pending} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
              {pending ? 'Enviando...' : 'Enviar Solicitação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const MEDAL = ['🥇', '🥈', '🥉']

const ACCENT_STYLES = {
  red:   { bar: 'bg-red-500',   text: 'text-red-600',   badge: 'bg-red-50 text-red-700 ring-red-200',   header: 'border-t-red-500'   },
  amber: { bar: 'bg-amber-500', text: 'text-amber-600', badge: 'bg-amber-50 text-amber-700 ring-amber-200', header: 'border-t-amber-500' },
  blue:  { bar: 'bg-blue-500',  text: 'text-blue-700',  badge: 'bg-blue-50 text-blue-700 ring-blue-200',  header: 'border-t-blue-500'  },
}

type RankingItem = {
  key: string
  titulo: string
  subtitulo: string
  valor: number
  unidade: string
  badge: string
  maxValor: number
  tituloDestaque?: boolean
}

function RankingCard({
  titulo,
  accentColor,
  items,
}: {
  titulo: string
  accentColor: 'red' | 'amber' | 'blue'
  items: RankingItem[]
}) {
  const style = ACCENT_STYLES[accentColor]
  return (
    <div className={cn('rounded-xl border border-gray-100 border-t-4 bg-white shadow-sm', style.header)}>
      <div className="border-b border-gray-100 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{titulo}</p>
      </div>
      <div className="divide-y divide-gray-50">
        {items.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">Sem dados</p>
        ) : (
          items.map((r, i) => {
            const pct = Math.round((r.valor / r.maxValor) * 100)
            const isTop3 = i < 3
            return (
              <div
                key={r.key}
                className={cn(
                  'px-5 py-3 transition-colors',
                  i === 0 ? 'bg-gray-50/70' : 'hover:bg-gray-50/50',
                )}
              >
                <div className="flex items-start gap-3">
                  <span className={cn('mt-0.5 w-6 shrink-0 text-center text-sm', isTop3 ? '' : 'text-xs font-bold text-gray-300 leading-5')}>
                    {isTop3 ? MEDAL[i] : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={cn('truncate text-sm font-semibold', r.tituloDestaque ? style.text : 'text-gray-900')}>
                        {r.titulo}
                      </p>
                      <div className="shrink-0 text-right">
                        <span className={cn('text-base font-black tabular-nums', style.text)}>{r.valor}{r.unidade}</span>
                        <span className={cn('ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset', style.badge)}>
                          {r.badge}
                        </span>
                      </div>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-400">{r.subtitulo}</p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={cn('h-full rounded-full transition-all', style.bar, i === 0 ? 'opacity-100' : i === 1 ? 'opacity-80' : i === 2 ? 'opacity-65' : 'opacity-40')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export function AtestadosClient({ atestados, cids }: Props) {
  const [editando, setEditando] = useState<AtestadoRow | null>(null)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [erroExcluir, setErroExcluir] = useState('')
  const [pendingDelete, setPendingDelete] = useState(false)
  const [sortCol, setSortCol] = useState<SortCol>('data_inicio')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [aba, setAba] = useState<'lista' | 'ranking'>('lista')
  const [janelaRanking, setJanelaRanking] = useState<30 | 60 | 90 | 180>(90)
  const [inssModal, setInssModal] = useState<InssModalState | null>(null)

  // Data do atestado mais antigo por funcionário (para pré-preencher o modal INSS)
  const primeiroAtestadoMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of atestados) {
      const cur = map.get(a.funcionario_id)
      if (!cur || a.data_inicio < cur) map.set(a.funcionario_id, a.data_inicio)
    }
    return map
  }, [atestados])

  // Apenas o atestado mais recente de cada funcionário com alerta exibe o badge INSS
  const ultimoAlertaIds = useMemo(() => {
    const map = new Map<string, { id: string; data: string }>()
    for (const a of atestados) {
      if (!a.alerta) continue
      const cur = map.get(a.funcionario_id)
      if (!cur || a.data_inicio > cur.data) map.set(a.funcionario_id, { id: a.id, data: a.data_inicio })
    }
    return new Set(Array.from(map.values()).map(v => v.id))
  }, [atestados])

  function handleSort(col: SortCol) {
    if (col === sortCol) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('asc') }
  }

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...atestados].sort((a, b) => {
      switch (sortCol) {
        case 'funcionario_nome':
        case 'posto_nome':
        case 'secretaria':
          return dir * (a[sortCol] ?? '').localeCompare(b[sortCol] ?? '', 'pt-BR', { sensitivity: 'base' })
        case 'data_inicio':
        case 'data_fim':
          return dir * a[sortCol].localeCompare(b[sortCol])
        case 'dias':
        case 'acumulado':
          return dir * (a[sortCol] - b[sortCol])
        default:
          return 0
      }
    })
  }, [atestados, sortCol, sortDir])

  const rankingFuncionarios = useMemo(() => {
    const limite = new Date()
    limite.setDate(limite.getDate() - janelaRanking)
    const limStr = limite.toISOString().split('T')[0]
    const map = new Map<string, { nome: string; supervisor: string | null; posto: string; secretaria: string; dias: number; ocorrencias: number }>()
    for (const a of atestados) {
      if ((a.data_fim ?? a.data_inicio) < limStr) continue
      const cur = map.get(a.funcionario_id) ?? { nome: a.funcionario_nome, supervisor: a.supervisor_nome, posto: a.posto_nome, secretaria: a.secretaria, dias: 0, ocorrencias: 0 }
      cur.dias += a.dias
      cur.ocorrencias += 1
      map.set(a.funcionario_id, cur)
    }
    return Array.from(map.values()).sort((a, b) => b.dias - a.dias).slice(0, 10)
  }, [atestados, janelaRanking])

  const rankingPostos = useMemo(() => {
    const limite = new Date()
    limite.setDate(limite.getDate() - janelaRanking)
    const limStr = limite.toISOString().split('T')[0]
    const map = new Map<string, { posto: string; secretaria: string; supervisor: string | null; dias: number; ocorrencias: number }>()
    for (const a of atestados) {
      if ((a.data_fim ?? a.data_inicio) < limStr) continue
      const key = a.posto_nome
      const cur = map.get(key) ?? { posto: a.posto_nome, secretaria: a.secretaria, supervisor: a.supervisor_nome, dias: 0, ocorrencias: 0 }
      cur.dias += a.dias
      cur.ocorrencias += 1
      map.set(key, cur)
    }
    return Array.from(map.values()).sort((a, b) => b.dias - a.dias).slice(0, 10)
  }, [atestados, janelaRanking])

  const rankingCids = useMemo(() => {
    const limite = new Date()
    limite.setDate(limite.getDate() - janelaRanking)
    const limStr = limite.toISOString().split('T')[0]
    const map = new Map<string, { codigo: string; descricao: string; dias: number; ocorrencias: number }>()
    for (const a of atestados) {
      if ((a.data_fim ?? a.data_inicio) < limStr || !a.cid_codigo) continue
      const key = a.cid_codigo
      const cur = map.get(key) ?? { codigo: a.cid_codigo, descricao: a.cid_desc || a.cid_codigo, dias: 0, ocorrencias: 0 }
      cur.dias += a.dias
      cur.ocorrencias += 1
      map.set(key, cur)
    }
    return Array.from(map.values()).sort((a, b) => b.ocorrencias - a.ocorrencias).slice(0, 10)
  }, [atestados, janelaRanking])

  async function confirmarExclusao() {
    if (!excluindoId) return
    setPendingDelete(true)
    setErroExcluir('')
    const res = await deleteAtestado(excluindoId)
    setPendingDelete(false)
    if (res.error) { setErroExcluir(res.error); return }
    setExcluindoId(null)
  }

  return (
    <>
      {/* Barra de abas + seletor de janela */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
          <button
            type="button"
            onClick={() => setAba('lista')}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              aba === 'lista' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            Lista
          </button>
          <button
            type="button"
            onClick={() => setAba('ranking')}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              aba === 'ranking' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            Ranking
          </button>
        </div>
        <div className="flex items-center gap-3">
          {aba === 'lista' && (
            <button
              type="button"
              onClick={() => exportExcel(sorted)}
              className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Download size={13} />
              Exportar Excel
            </button>
          )}
          {aba === 'ranking' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Janela:</span>
              {([30, 60, 90, 180] as const).map(j => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setJanelaRanking(j)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium',
                    janelaRanking === j
                      ? 'bg-slate-900 text-white'
                      : 'border border-gray-200 text-gray-500 hover:bg-gray-50',
                  )}
                >
                  {j}d
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Seção Ranking */}
      {aba === 'ranking' && (
        <div className="p-5">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Top Funcionários — Dias */}
            <RankingCard
              titulo="Top Funcionários — Dias"
              accentColor="red"
              items={rankingFuncionarios.map(r => ({
                key: r.nome,
                titulo: r.nome,
                subtitulo: `${r.supervisor ?? '—'} · ${r.secretaria}`,
                valor: r.dias,
                unidade: 'd',
                badge: `${r.ocorrencias}x`,
                maxValor: rankingFuncionarios[0]?.dias ?? 1,
              }))}
            />

            {/* Top Unidades — Dias */}
            <RankingCard
              titulo="Top Unidades — Dias"
              accentColor="amber"
              items={rankingPostos.map(r => ({
                key: r.posto,
                titulo: r.posto,
                subtitulo: `${r.supervisor ?? '—'} · ${r.secretaria}`,
                valor: r.dias,
                unidade: 'd',
                badge: `${r.ocorrencias}x`,
                maxValor: rankingPostos[0]?.dias ?? 1,
              }))}
            />

            {/* CIDs Mais Recorrentes */}
            <RankingCard
              titulo="CIDs Mais Recorrentes"
              accentColor="blue"
              items={rankingCids.map(r => ({
                key: r.codigo,
                titulo: r.codigo,
                subtitulo: r.descricao,
                valor: r.ocorrencias,
                unidade: 'x',
                badge: `${r.dias}d`,
                maxValor: rankingCids[0]?.ocorrencias ?? 1,
                tituloDestaque: true,
              }))}
            />
          </div>
        </div>
      )}

      {/* Seção Lista */}
      {aba === 'lista' && (
        atestados.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">Nenhum atestado encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-slate-50">
                <tr>
                  {COLS.map(col => (
                    <th
                      key={col.label}
                      onClick={col.sortKey ? () => handleSort(col.sortKey!) : undefined}
                      className={cn(
                        'px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest',
                        col.sortKey === sortCol ? 'text-gray-700' : 'text-gray-400',
                        col.sortKey && 'cursor-pointer select-none hover:text-gray-600',
                      )}
                    >
                      {col.label}
                      {col.sortKey === sortCol && (
                        <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map(a => (
                  <tr
                    key={a.id}
                    className={cn(
                      'transition-colors',
                      a.alerta ? 'bg-red-50 hover:bg-red-100' : 'bg-white hover:bg-gray-50',
                    )}
                  >
                    <td className="px-5 py-3.5 font-medium text-gray-900">{a.funcionario_nome}</td>
                    <td className="px-5 py-3.5 text-gray-500">{a.posto_nome}</td>
                    <td className="px-5 py-3.5 text-gray-500">{a.secretaria}</td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {a.supervisor_nome
                        ? <span className="inline-flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                            {a.supervisor_nome}
                          </span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-gray-500">
                      {a.data_inicio.split('-').reverse().join('/')}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-gray-500">
                      {a.data_fim.split('-').reverse().join('/')}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-gray-700">{a.dias}</td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {a.cid_codigo ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-blue-700">{a.cid_codigo}</span>
                          {a.cid_desc && a.cid_desc !== a.cid_codigo && (
                            <span className="text-gray-400">— {a.cid_desc}</span>
                          )}
                          {a.nexo_ocupacional && (
                            <span title="Possível nexo ocupacional — avaliar CAT/insalubridade">
                              <AlertTriangle className="shrink-0 text-amber-500" size={14} />
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400">{a.cid_desc || '—'}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {a.origem_ocupacional ? (
                        <span className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap',
                          ORIGEM_BADGE[a.origem_ocupacional]?.className,
                        )}>
                          {ORIGEM_BADGE[a.origem_ocupacional]?.label}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {a.tem_cobertura
                        ? <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-200">✓ Registrada</span>
                        : <span className="text-gray-300 text-xs">—</span>
                      }
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className={cn('tabular-nums font-semibold', a.alerta ? 'text-red-700' : 'text-gray-700')}>
                          {a.acumulado}d
                        </span>
                        {ultimoAlertaIds.has(a.id) && (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-red-700 ring-1 ring-inset ring-red-200">
                            ⚠️ Avaliar INSS
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {excluindoId === a.id ? (
                        <div className="flex flex-col gap-1">
                          <p className="text-xs text-gray-600">Tem certeza? Esta ação não pode ser desfeita.</p>
                          {erroExcluir && <p className="text-xs text-red-600">{erroExcluir}</p>}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={confirmarExclusao}
                              disabled={pendingDelete}
                              className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              {pendingDelete ? '...' : 'Confirmar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setExcluindoId(null); setErroExcluir('') }}
                              className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {ultimoAlertaIds.has(a.id) && (
                            <button
                              type="button"
                              onClick={() => setInssModal({
                                funcionario_id: a.funcionario_id,
                                funcionario_nome: a.funcionario_nome,
                                data_inicio: primeiroAtestadoMap.get(a.funcionario_id) ?? a.data_inicio,
                                dias: a.acumulado,
                                motivo: 'INSS - Doença',
                              })}
                              className="rounded border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                              Solicitar INSS
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditando(a)}
                            className="rounded border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setExcluindoId(a.id)}
                            className="rounded border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Excluir
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      <ModalEditarAtestado
        atestado={editando}
        onClose={() => setEditando(null)}
        cids={cids}
      />

      {inssModal && (
        <ModalSolicitarInss
          state={inssModal}
          onClose={() => setInssModal(null)}
        />
      )}
    </>
  )
}
