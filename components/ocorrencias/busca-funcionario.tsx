'use client'

import { useMemo, useState } from 'react'
import type { FuncionarioPainel } from '@/app/(admin)/ocorrencias/actions'
import { exportToExcel } from '@/lib/export-excel'

const inputClass =
  'h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-sm text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

type SortCol = 'nome' | 'registro' | 'posto' | 'supervisor' | 'total' | 'advertencias' | 'atestados' | 'faltas' | 'ocorrencias' | 'aguardando'
type SortDir = 'asc' | 'desc'
type Categoria = 'advertencias' | 'atestados' | 'faltas' | 'ocorrencias'

function diasDesde(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / 86400000))
}

const MAX_LINHAS = 200

// colunas de texto ordenam A→Z no primeiro clique; colunas numéricas, maior→menor
const TEXT_COLS = new Set<SortCol>(['nome', 'registro', 'posto', 'supervisor'])

const FIXED_COLS: { key: SortCol; label: string }[] = [
  { key: 'nome',       label: 'Funcionário'      },
  { key: 'registro',   label: 'Matrícula'        },
  { key: 'posto',      label: 'Posto de Trabalho' },
  { key: 'supervisor', label: 'Supervisor(es)'   },
]

const COUNT_COLS: { key: SortCol; label: string }[] = [
  { key: 'advertencias', label: 'Advertências' },
  { key: 'atestados',    label: 'Atestados'    },
  { key: 'faltas',       label: 'Faltas'       },
  { key: 'ocorrencias',  label: 'Ocorrências'  },
]

function CounterCard({
  label,
  value,
  topColor,
  onClick,
  ativo,
}: {
  label: string
  value: number
  topColor: string
  onClick?: () => void
  ativo?: boolean
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        `rounded-xl border border-gray-100 border-t-4 bg-white p-3 text-left shadow-sm ${topColor}`,
        onClick ? 'cursor-pointer transition hover:shadow-md' : '',
        ativo ? 'ring-2 ring-gray-400' : '',
      ].join(' ')}
    >
      <p className="text-2xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </Tag>
  )
}

function totalRegistros(f: FuncionarioPainel): number {
  return f.contagens.advertencias + f.contagens.atestados + f.contagens.faltas + f.contagens.ocorrencias
}

const STATUS_LABEL = { gestao: 'gestão', supervisor: 'supervisor' } as const

export function BuscaFuncionario({
  funcionarios,
  onSelect,
  ehGestao,
}: {
  funcionarios: FuncionarioPainel[]
  onSelect: (id: string) => void
  ehGestao: boolean
}) {
  const ladoViewer = ehGestao ? 'gestao' : 'supervisor'

  const [busca, setBusca]             = useState('')
  const [secretaria, setSecretaria]   = useState('')
  const [supervisor, setSupervisor]   = useState('')
  const [posto, setPosto]             = useState('')
  const [sortCol, setSortCol]         = useState<SortCol>('total')
  const [sortDir, setSortDir]         = useState<SortDir>('desc')
  const [soAguardando, setSoAguardando]   = useState(false)
  const [categoria, setCategoria]         = useState<Categoria | null>(null)

  const secretarias = useMemo(
    () => Array.from(new Set(funcionarios.map(f => f.secretaria).filter(Boolean))).sort(),
    [funcionarios],
  )
  const supervisores = useMemo(
    () => Array.from(new Set(funcionarios.flatMap(f => f.supervisor_nomes))).sort(),
    [funcionarios],
  )
  const postos = useMemo(
    () => Array.from(new Set(funcionarios.map(f => f.posto_nome).filter(Boolean))).sort(),
    [funcionarios],
  )

  const temBusca = busca.trim().length > 0

  const filtrados = useMemo(() => {
    let list = funcionarios
    if (secretaria) list = list.filter(f => f.secretaria === secretaria)
    if (supervisor) list = list.filter(f => f.supervisor_nomes.includes(supervisor))
    if (posto) list = list.filter(f => f.posto_nome === posto)
    if (categoria) list = list.filter(f => f.contagens[categoria] > 0)
    if (soAguardando) list = list.filter(f => f.aguardando === ladoViewer)
    if (temBusca) {
      const termo = busca.trim().toLowerCase()
      list = list.filter(f => f.nome.toLowerCase().includes(termo))
    } else {
      list = list.filter(f => totalRegistros(f) > 0)
    }
    return list
  }, [funcionarios, busca, secretaria, supervisor, posto, temBusca, soAguardando, categoria, ladoViewer])

  const ordenados = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtrados].sort((a, b) => {
      switch (sortCol) {
        case 'nome':
          return dir * a.nome.localeCompare(b.nome, undefined, { sensitivity: 'base' })
        case 'registro':
          return dir * (a.registro ?? '').localeCompare(b.registro ?? '', undefined, { numeric: true })
        case 'posto':
          return dir * a.posto_nome.localeCompare(b.posto_nome, undefined, { sensitivity: 'base' })
        case 'supervisor':
          return dir * (a.supervisor_nomes.join(', ')).localeCompare(b.supervisor_nomes.join(', '), undefined, { sensitivity: 'base' })
        case 'total':
          return dir * (totalRegistros(a) - totalRegistros(b))
        case 'advertencias':
          return dir * (a.contagens.advertencias - b.contagens.advertencias)
        case 'atestados':
          return dir * (a.contagens.atestados - b.contagens.atestados)
        case 'faltas':
          return dir * (a.contagens.faltas - b.contagens.faltas)
        case 'ocorrencias':
          return dir * (a.contagens.ocorrencias - b.contagens.ocorrencias)
        case 'aguardando': {
          // sem pendência vai pro final, independente da direção
          if (!a.aguardandoDesde && !b.aguardandoDesde) return 0
          if (!a.aguardandoDesde) return 1
          if (!b.aguardandoDesde) return -1
          return dir * (new Date(a.aguardandoDesde).getTime() - new Date(b.aguardandoDesde).getTime())
        }
        default:
          return 0
      }
    })
  }, [filtrados, sortCol, sortDir])

  const cards = useMemo(() => {
    let comRegistro = 0
    let advertencias = 0
    let atestados = 0
    let faltas = 0
    let ocorrencias = 0
    for (const f of filtrados) {
      if (totalRegistros(f) > 0) comRegistro++
      advertencias += f.contagens.advertencias
      atestados += f.contagens.atestados
      faltas += f.contagens.faltas
      ocorrencias += f.contagens.ocorrencias
    }
    return { comRegistro, advertencias, atestados, faltas, ocorrencias }
  }, [filtrados])

  // counts independem do próprio toggle (senão o card zeraria a si mesmo ao ativar)
  const escopoCards = useMemo(
    () => (secretaria ? funcionarios.filter(f => f.secretaria === secretaria) : funcionarios),
    [funcionarios, secretaria],
  )
  const totalAguardando = useMemo(
    () => escopoCards.filter(f => f.aguardando === ladoViewer).length,
    [escopoCards, ladoViewer],
  )
  const totaisCategoria = useMemo(() => {
    const t: Record<Categoria, number> = { advertencias: 0, atestados: 0, faltas: 0, ocorrencias: 0 }
    for (const f of escopoCards) {
      t.advertencias += f.contagens.advertencias
      t.atestados += f.contagens.atestados
      t.faltas += f.contagens.faltas
      t.ocorrencias += f.contagens.ocorrencias
    }
    return t
  }, [escopoCards])

  const visiveis = ordenados.slice(0, MAX_LINHAS)
  const cortado = ordenados.length > MAX_LINHAS

  function handleSort(col: SortCol) {
    if (col === sortCol) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir(TEXT_COLS.has(col) ? 'asc' : 'desc') }
  }

  function handleExportar() {
    exportToExcel(
      ordenados,
      [
        { label: 'Funcionário',       value: f => f.nome },
        { label: 'Matrícula',         value: f => f.registro ?? '—' },
        { label: 'Posto de Trabalho', value: f => f.posto_nome },
        { label: 'Secretaria',        value: f => f.secretaria || '—' },
        { label: 'Supervisor(es)',    value: f => f.supervisor_nomes.join(', ') || '—' },
        { label: 'Advertências',      value: f => f.contagens.advertencias },
        { label: 'Atestados',         value: f => f.contagens.atestados },
        { label: 'Faltas',            value: f => f.contagens.faltas },
        { label: 'Ocorrências',       value: f => f.contagens.ocorrencias },
      ],
      `funcionarios-ocorrencias-${new Date().toISOString().split('T')[0]}.xlsx`,
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <CounterCard label="Funcionários c/ Registro" value={cards.comRegistro} topColor="border-t-gray-400" />
        <CounterCard
          label="Advertências"
          value={totaisCategoria.advertencias}
          topColor="border-t-orange-500"
          onClick={() => setCategoria(c => (c === 'advertencias' ? null : 'advertencias'))}
          ativo={categoria === 'advertencias'}
        />
        <CounterCard
          label="Atestados"
          value={totaisCategoria.atestados}
          topColor="border-t-blue-500"
          onClick={() => setCategoria(c => (c === 'atestados' ? null : 'atestados'))}
          ativo={categoria === 'atestados'}
        />
        <CounterCard
          label="Faltas"
          value={totaisCategoria.faltas}
          topColor="border-t-red-500"
          onClick={() => setCategoria(c => (c === 'faltas' ? null : 'faltas'))}
          ativo={categoria === 'faltas'}
        />
        <CounterCard
          label="Ocorrências"
          value={totaisCategoria.ocorrencias}
          topColor="border-t-purple-500"
          onClick={() => setCategoria(c => (c === 'ocorrencias' ? null : 'ocorrencias'))}
          ativo={categoria === 'ocorrencias'}
        />
        <CounterCard
          label="Aguardando Sua Resposta"
          value={totalAguardando}
          topColor="border-t-rose-500"
          onClick={() => {
            setSoAguardando(v => {
              const next = !v
              if (next) { setSortCol('aguardando'); setSortDir('asc') } // mais antiga (mais urgente) primeiro
              return next
            })
          }}
          ativo={soAguardando}
        />
      </div>

      {(categoria || soAguardando || secretaria || supervisor || posto) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="font-semibold uppercase tracking-widest text-gray-400">Filtros ativos:</span>
          {categoria && (
            <button
              type="button"
              onClick={() => setCategoria(null)}
              className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-600 hover:bg-gray-200"
            >
              {COUNT_COLS.find(c => c.key === categoria)?.label} ×
            </button>
          )}
          {soAguardando && (
            <button
              type="button"
              onClick={() => setSoAguardando(false)}
              className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-600 hover:bg-gray-200"
            >
              Aguardando sua resposta ×
            </button>
          )}
          {secretaria && (
            <button type="button" onClick={() => setSecretaria('')} className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-600 hover:bg-gray-200">
              {secretaria} ×
            </button>
          )}
          {supervisor && (
            <button type="button" onClick={() => setSupervisor('')} className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-600 hover:bg-gray-200">
              {supervisor} ×
            </button>
          )}
          {posto && (
            <button type="button" onClick={() => setPosto('')} className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-600 hover:bg-gray-200">
              {posto} ×
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar funcionário pelo nome…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className={inputClass + ' max-w-xs'}
        />
        <select
          value={secretaria}
          onChange={e => setSecretaria(e.target.value)}
          className={inputClass + ' max-w-xs'}
        >
          <option value="">Todas as secretarias</option>
          {secretarias.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={supervisor}
          onChange={e => setSupervisor(e.target.value)}
          className={inputClass + ' max-w-xs'}
        >
          <option value="">Todos os supervisores</option>
          {supervisores.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={posto}
          onChange={e => setPosto(e.target.value)}
          className={inputClass + ' max-w-xs'}
        >
          <option value="">Todos os postos</option>
          {postos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button
          type="button"
          onClick={handleExportar}
          className="ml-auto h-9 rounded-lg bg-amber-500 px-4 text-xs font-semibold uppercase tracking-widest text-slate-900 hover:bg-amber-400"
        >
          Exportar Excel
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {[...FIXED_COLS, ...COUNT_COLS].map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={[
                      'cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest hover:text-gray-600',
                      sortCol === col.key ? 'text-gray-700' : 'text-gray-400',
                    ].join(' ')}
                  >
                    {col.label}
                    {sortCol === col.key && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                ))}
                <th
                  onClick={() => handleSort('aguardando')}
                  className={[
                    'cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest hover:text-gray-600',
                    sortCol === 'aguardando' ? 'text-gray-700' : 'text-gray-400',
                  ].join(' ')}
                >
                  Status
                  {sortCol === 'aguardando' && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visiveis.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">
                    {soAguardando
                      ? 'Nada aguardando sua resposta'
                      : temBusca || secretaria || supervisor || posto || categoria
                        ? 'Nenhum funcionário encontrado'
                        : 'Nenhum funcionário com registro no momento'}
                  </td>
                </tr>
              ) : (
                visiveis.map(f => (
                  <tr key={f.id} onClick={() => onSelect(f.id)} className="cursor-pointer hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{f.nome}</td>
                    <td className="px-4 py-3 text-gray-600">{f.registro ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{f.posto_nome}{f.secretaria ? ` — ${f.secretaria}` : ''}</td>
                    <td className="px-4 py-3 text-gray-600">{f.supervisor_nomes.join(', ') || '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-gray-600">{f.contagens.advertencias}</td>
                    <td className="px-4 py-3 tabular-nums text-gray-600">{f.contagens.atestados}</td>
                    <td className="px-4 py-3 tabular-nums text-gray-600">{f.contagens.faltas}</td>
                    <td className="px-4 py-3 tabular-nums text-gray-600">{f.contagens.ocorrencias}</td>
                    <td className="px-4 py-3">
                      {f.aguardando === ladoViewer ? (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                          Aguardando você{f.aguardandoDesde ? ` · há ${diasDesde(f.aguardandoDesde)}d` : ''}
                        </span>
                      ) : f.aguardando ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          Aguardando {STATUS_LABEL[f.aguardando]}{f.aguardandoDesde ? ` · há ${diasDesde(f.aguardandoDesde)}d` : ''}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {cortado && (
          <p className="border-t border-gray-100 px-4 py-2 text-center text-xs text-gray-400">
            Mostrando {MAX_LINHAS} de {ordenados.length} — refine a busca pra ver mais
          </p>
        )}
      </div>
    </div>
  )
}
