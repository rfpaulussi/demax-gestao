'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  agendarFerias, aprovarFerias, cancelarFerias,
  buscarFuncionarioParaFerias, buscarPeriodosAquisitivos,
  buscarFeriasLista, buscarSupervisoresParaFiltro,
} from './actions'
import type { FeriasListaItem, SupervisorOpcao } from './actions'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Posto = { nome: string; secretaria: string }

type Funcionario = {
  id: string
  nome: string
  cpf: string
  status: string
  postos?: Posto | null
}

type Ferias = {
  id: string
  funcionario_id: string
  funcionario?: { nome: string; registro?: string; postos?: Posto | null }
  numero_periodo: number
  periodo_inicio: string
  periodo_fim: string
  limite_gozo: string
  dias_direito: number
  data_inicio: string
  data_fim: string
  dias_utilizados: number
  status: string
  observacao?: string
  aprovado_em?: string
}

type SortKey = keyof Pick<FeriasListaItem,
  'funcionario_nome' | 'posto_nome' | 'secretaria' | 'supervisor_nome' |
  'numero_periodo' | 'data_inicio' | 'data_fim' | 'dias_direito' | 'status'
>

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  disponivel: { label: 'Disponível', color: 'bg-slate-100 text-slate-500'   },
  agendado:   { label: 'Agendado',   color: 'bg-blue-100 text-blue-800'     },
  aprovado:   { label: 'Aprovado',   color: 'bg-indigo-100 text-indigo-800' },
  em_curso:   { label: 'Em Curso',   color: 'bg-amber-100 text-amber-800'   },
  concluido:  { label: 'Concluído',  color: 'bg-green-100 text-green-800'   },
  cancelado:  { label: 'Cancelado',  color: 'bg-gray-100 text-gray-500'     },
}

function fmt(date?: string | null) {
  if (!date) return '—'
  return new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span className="ml-1 text-slate-300">↕</span>
  return <span className="ml-1 text-slate-700">{dir === 'asc' ? '↑' : '↓'}</span>
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FeriasPage() {
  const [ferias, setFerias]           = useState<FeriasListaItem[]>([])
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)

  // Filtros
  const [filtroStatus, setFiltroStatus]         = useState('todos')
  const [filtroSecretaria, setFiltroSecretaria] = useState('todas')
  const [filtroSupervisor, setFiltroSupervisor] = useState('todos')
  const [secretarias, setSecretarias]           = useState<string[]>([])
  const [supervisores, setSupervisores]         = useState<SupervisorOpcao[]>([])

  // Ordenação
  const [sortKey, setSortKey]   = useState<SortKey>('data_inicio')
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('desc')

  // Modal state
  const [busca, setBusca]                           = useState('')
  const [resultados, setResultados]                 = useState<Funcionario[]>([])
  const [funcSelecionado, setFuncSelecionado]       = useState<Funcionario | null>(null)
  const [periodos, setPeriodos]                     = useState<Ferias[]>([])
  const [periodoSelecionado, setPeriodoSelecionado] = useState<Ferias | null>(null)
  const [dataInicio, setDataInicio]                 = useState('')
  const [dataFim, setDataFim]                       = useState('')
  const [observacao, setObservacao]                 = useState('')
  const [salvando, setSalvando]                     = useState(false)
  const [erro, setErro]                             = useState('')

  const [, startTransition] = useTransition()

  async function carregarFerias() {
    setLoading(true)
    const [lista, sups] = await Promise.all([
      buscarFeriasLista(),
      buscarSupervisoresParaFiltro(),
    ])
    setFerias(lista)
    setSupervisores(sups)
    const secs = Array.from(new Set(lista.map(f => f.secretaria).filter(s => s && s !== '—'))) as string[]
    setSecretarias(secs.sort())
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregarFerias() }, [])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const feriasFiltered = ferias
    .filter(f => {
      if (filtroStatus !== 'todos' && f.status !== filtroStatus) return false
      if (filtroSecretaria !== 'todas' && f.secretaria !== filtroSecretaria) return false
      if (filtroSupervisor !== 'todos' && f.supervisor_nome !== filtroSupervisor) return false
      return true
    })
    .sort((a, b) => {
      const va = a[sortKey] ?? ''
      const vb = b[sortKey] ?? ''
      const cmp = String(va).localeCompare(String(vb), 'pt-BR', { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })

  const kpis = {
    total:      ferias.length,
    agendadas:  ferias.filter(f => f.status === 'agendado').length,
    em_curso:   ferias.filter(f => f.status === 'em_curso').length,
    concluidas: ferias.filter(f => f.status === 'concluido').length,
  }

  async function handleBusca(valor: string) {
    setBusca(valor)
    if (valor.length < 2) { setResultados([]); return }
    const res = await buscarFuncionarioParaFerias(valor)
    setResultados((res ?? []) as unknown as Funcionario[])
  }

  async function handleSelecionarFuncionario(f: Funcionario) {
    setFuncSelecionado(f)
    setResultados([])
    setBusca(f.nome)
    const res = await buscarPeriodosAquisitivos(f.id)
    const todos = (res ?? []) as unknown as Ferias[]
    setPeriodos(todos.filter(p => !['agendado', 'em_curso', 'concluido'].includes(p.status)))
  }

  async function handleSalvar() {
    if (!funcSelecionado || !periodoSelecionado || !dataInicio || !dataFim) {
      setErro('Preencha todos os campos obrigatórios.')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      await agendarFerias({
        funcionario_id: funcSelecionado.id,
        numero_periodo: periodoSelecionado.numero_periodo,
        periodo_inicio: periodoSelecionado.periodo_inicio,
        periodo_fim:    periodoSelecionado.periodo_fim,
        limite_gozo:    periodoSelecionado.limite_gozo,
        dias_direito:   periodoSelecionado.dias_direito,
        data_inicio:    dataInicio,
        data_fim:       dataFim,
        observacao,
      })
      setShowModal(false)
      resetModal()
      carregarFerias()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao agendar.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleAprovar(id: string) {
    startTransition(async () => {
      await aprovarFerias(id)
      carregarFerias()
    })
  }

  const handleCancelar = async (id: string, nome: string) => {
    if (!window.confirm(`Cancelar férias de ${nome}?\n\nEsta ação irá reverter o status para "ativo" e não pode ser desfeita.`)) return
    setLoading(true)
    try {
      await cancelarFerias(id)
      await carregarFerias()
    } catch {
      alert('Erro ao cancelar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  function resetModal() {
    setBusca(''); setResultados([]); setFuncSelecionado(null)
    setPeriodos([]); setPeriodoSelecionado(null)
    setDataInicio(''); setDataFim(''); setObservacao(''); setErro('')
  }

  const diasCalculados = dataInicio && dataFim
    ? Math.ceil((new Date(dataFim).getTime() - new Date(dataInicio).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0

  const colunas: { label: string; key: SortKey }[] = [
    { label: 'Funcionário', key: 'funcionario_nome' },
    { label: 'Posto',       key: 'posto_nome'       },
    { label: 'Secretaria',  key: 'secretaria'       },
    { label: 'Supervisor',  key: 'supervisor_nome'  },
    { label: 'Período',     key: 'numero_periodo'   },
    { label: 'Início',      key: 'data_inicio'      },
    { label: 'Fim',         key: 'data_fim'         },
    { label: 'Dias',        key: 'dias_direito'     },
    { label: 'Status',      key: 'status'           },
  ]

  return (
    <div className="p-6 bg-slate-50 min-h-screen">

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Férias</h1>
          <p className="text-sm text-slate-500">Gestão de férias do quadro de funcionários</p>
        </div>
        <a
          href="/ferias/relatorio"
          className="inline-flex items-center gap-1 text-sm font-semibold bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-700 transition"
        >
          ↗ Relação por Supervisor
        </a>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'TOTAL',      value: kpis.total,      color: 'border-slate-400' },
          { label: 'AGENDADAS',  value: kpis.agendadas,  color: 'border-amber-400' },
          { label: 'EM CURSO',   value: kpis.em_curso,   color: 'border-blue-400'  },
          { label: 'CONCLUÍDAS', value: kpis.concluidas, color: 'border-green-400' },
        ].map(k => (
          <div key={k.label} className={`bg-white rounded-lg shadow-sm border-t-4 ${k.color} p-4`}>
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">{k.label}</p>
            <p className="text-4xl font-bold text-slate-900">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          className="border border-slate-200 rounded px-3 py-2 text-sm bg-white">
          <option value="todos">Todos os status</option>
          <option value="disponivel">Disponível</option>
          <option value="agendado">Agendado</option>
          <option value="aprovado">Aprovado</option>
          <option value="em_curso">Em Curso</option>
          <option value="concluido">Concluído</option>
          <option value="cancelado">Cancelado</option>
        </select>

        <select value={filtroSecretaria} onChange={e => setFiltroSecretaria(e.target.value)}
          className="border border-slate-200 rounded px-3 py-2 text-sm bg-white">
          <option value="todas">Todas as secretarias</option>
          {secretarias.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={filtroSupervisor} onChange={e => setFiltroSupervisor(e.target.value)}
          className="border border-slate-200 rounded px-3 py-2 text-sm bg-white min-w-[180px]">
          <option value="todos">Todos os supervisores</option>
          {supervisores.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
        </select>

        <span className="text-xs text-slate-400 ml-1">
          {feriasFiltered.length} registro{feriasFiltered.length !== 1 ? 's' : ''}
        </span>

        <div className="ml-auto">
          <button onClick={() => setShowModal(true)}
            className="bg-slate-900 text-white px-4 py-2 rounded text-sm hover:bg-slate-700 transition">
            + Nova Férias
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {colunas.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-3 text-left text-xs uppercase tracking-wider text-slate-500 font-medium cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap"
                >
                  {col.label}
                  <SortIcon active={sortKey === col.key} dir={sortDir} />
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-slate-500 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>
            ) : feriasFiltered.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">Nenhum registro encontrado.</td></tr>
            ) : feriasFiltered.map(f => (
              <tr key={f.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{f.funcionario_nome}</td>
                <td className="px-4 py-3 text-slate-600">{f.posto_nome}</td>
                <td className="px-4 py-3 text-slate-600">{f.secretaria}</td>
                <td className="px-4 py-3 text-slate-600">{f.supervisor_nome}</td>
                <td className="px-4 py-3 text-slate-600 text-center">{f.numero_periodo}º</td>
                <td className="px-4 py-3 text-slate-600">{fmt(f.data_inicio)}</td>
                <td className="px-4 py-3 text-slate-600">{fmt(f.data_fim)}</td>
                <td className="px-4 py-3 text-slate-600 text-center">{f.dias_direito}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_LABELS[f.status]?.color}`}>
                    {STATUS_LABELS[f.status]?.label || f.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {f.status === 'agendado' && (
                    <button
                      onClick={() => handleAprovar(f.id)}
                      className="text-xs bg-slate-900 text-white px-3 py-1 rounded hover:bg-slate-700"
                    >
                      Aprovar
                    </button>
                  )}
                  {(f.status === 'agendado' || f.status === 'em_curso') && (
                    <button
                      onClick={() => handleCancelar(f.id, f.funcionario_nome)}
                      className="text-xs text-red-600 hover:text-red-800 px-3 py-1 block mt-1"
                    >
                      Cancelar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Nova Férias</h2>

            <div className="mb-4">
              <label className="block text-xs uppercase tracking-widest text-slate-500 mb-1">Funcionário</label>
              <input value={busca} onChange={e => handleBusca(e.target.value)}
                placeholder="Digite o nome..."
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              {resultados.length > 0 && (
                <div className="border border-slate-200 rounded mt-1 max-h-40 overflow-y-auto shadow-sm">
                  {resultados.map(r => (
                    <button key={r.id} onClick={() => handleSelecionarFuncionario(r)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0">
                      <span className="font-medium">{r.nome}</span>
                      <span className="text-slate-400 ml-2 text-xs">{r.postos?.nome || '—'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {funcSelecionado && (
              <div className="mb-4">
                <label className="block text-xs uppercase tracking-widest text-slate-500 mb-1">Período Aquisitivo</label>
                {periodos.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhum período disponível para agendamento.</p>
                ) : (
                  <select onChange={e => setPeriodoSelecionado(periodos.find(p => p.id === e.target.value) ?? null)}
                    className="w-full border border-slate-200 rounded px-3 py-2 text-sm">
                    <option value="">Selecione o período...</option>
                    {periodos.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.numero_periodo}º período — {p.dias_direito} dias — limite: {fmt(p.limite_gozo)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {periodoSelecionado && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-slate-500 mb-1">Data Início</label>
                    <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                      className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-slate-500 mb-1">Data Fim</label>
                    <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                      className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
                  </div>
                </div>
                {diasCalculados > 0 && (
                  <p className="text-sm text-slate-600 mb-3">
                    <span className="font-medium">{diasCalculados} dias</span> de {periodoSelecionado.dias_direito} disponíveis
                    {diasCalculados > periodoSelecionado.dias_direito && (
                      <span className="text-red-500 ml-2">⚠ excede o direito</span>
                    )}
                  </p>
                )}
                <div className="mb-4">
                  <label className="block text-xs uppercase tracking-widest text-slate-500 mb-1">Observação</label>
                  <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2}
                    className="w-full border border-slate-200 rounded px-3 py-2 text-sm resize-none" />
                </div>
              </>
            )}

            {erro && <p className="text-red-500 text-sm mb-3">{erro}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowModal(false); resetModal() }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
              <button onClick={handleSalvar} disabled={salvando}
                className="bg-slate-900 text-white px-4 py-2 rounded text-sm hover:bg-slate-700 disabled:opacity-50">
                {salvando ? 'Salvando...' : 'Agendar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
