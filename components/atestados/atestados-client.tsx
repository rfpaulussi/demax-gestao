'use client'

import { useState, useMemo, useTransition } from 'react'
import { AlertTriangle } from 'lucide-react'
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
      if (a.data_fim < limStr) continue
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
      if (a.data_fim < limStr) continue
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
      if (a.data_fim < limStr || !a.cid_codigo) continue
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

      {/* Seção Ranking */}
      {aba === 'ranking' && (
        <div className="p-5">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Top Funcionários — Dias */}
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Top Funcionários — Dias</p>
              </div>
              <div className="divide-y divide-gray-50">
                {rankingFuncionarios.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-gray-400">Sem dados</p>
                ) : (
                  rankingFuncionarios.map((r, i) => (
                    <div key={r.nome} className="flex items-center gap-3 px-5 py-3">
                      <span className="w-5 text-xs font-bold text-gray-300">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">{r.nome}</p>
                        <p className="truncate text-xs text-gray-400">{r.supervisor ?? '—'} · {r.secretaria}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-600">{r.dias}d</p>
                        <p className="text-xs text-gray-400">{r.ocorrencias}x</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Top Unidades — Dias */}
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Top Unidades — Dias</p>
              </div>
              <div className="divide-y divide-gray-50">
                {rankingPostos.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-gray-400">Sem dados</p>
                ) : (
                  rankingPostos.map((r, i) => (
                    <div key={r.posto} className="flex items-center gap-3 px-5 py-3">
                      <span className="w-5 text-xs font-bold text-gray-300">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">{r.posto}</p>
                        <p className="truncate text-xs text-gray-400">{r.supervisor ?? '—'} · {r.secretaria}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-amber-600">{r.dias}d</p>
                        <p className="text-xs text-gray-400">{r.ocorrencias}x</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* CIDs Mais Recorrentes */}
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">CIDs Mais Recorrentes</p>
              </div>
              <div className="divide-y divide-gray-50">
                {rankingCids.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-gray-400">Sem dados</p>
                ) : (
                  rankingCids.map((r, i) => (
                    <div key={r.codigo} className="flex items-center gap-3 px-5 py-3">
                      <span className="w-5 text-xs font-bold text-gray-300">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-blue-700">{r.codigo}</p>
                        <p className="truncate text-xs text-gray-400">{r.descricao}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-700">{r.ocorrencias}x</p>
                        <p className="text-xs text-gray-400">{r.dias}d</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
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
                        {a.alerta && (
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
                          {a.alerta && (
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
