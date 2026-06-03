'use client'

import { useEffect, useState, useTransition } from 'react'
import { buscarFeriasParaRelatorio, buscarSupervisoresAtivos } from './actions'
import type { SupervisorOption } from './actions'
import { downloadRelatorioFerias } from '@/components/ferias/relatorio-supervisor-pdf'
import type { SupervisorRelatorio } from '@/components/ferias/relatorio-supervisor-pdf'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mesAtualDefault() {
  const d = new Date()
  const proximo = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  return { mes: proximo.getMonth() + 1, ano: proximo.getFullYear() }
}

function prazoRH(mes: number, ano: number): string {
  const mesAnterior = mes === 1 ? 12 : mes - 1
  const anoAnterior = mes === 1 ? ano - 1 : ano
  return `10/${String(mesAnterior).padStart(2, '0')}/${anoAnterior}`
}

function diasParaPrazo(mes: number, ano: number): number {
  const mesAnterior = mes === 1 ? 12 : mes - 1
  const anoAnterior = mes === 1 ? ano - 1 : ano
  const prazo = new Date(anoAnterior, mesAnterior - 1, 10)
  const hoje  = new Date()
  return Math.ceil((prazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  aprovado:  { label: 'Aprovado',  bg: 'bg-green-100',  text: 'text-green-800'  },
  agendado:  { label: 'Agendado',  bg: 'bg-blue-100',   text: 'text-blue-800'   },
  em_curso:  { label: 'Em Curso',  bg: 'bg-amber-100',  text: 'text-amber-800'  },
  concluido: { label: 'Concluído', bg: 'bg-gray-100',   text: 'text-gray-500'   },
  cancelado: { label: 'Cancelado', bg: 'bg-red-100',    text: 'text-red-600'    },
}

// ─── Componentes internos ──────────────────────────────────────────────────────

function BadgeStatus({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: 'bg-gray-100', text: 'text-gray-500' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TabelaSupervisor({ supervisor, itens }: { supervisor: string; itens: any[] }) {
  const nAprovados = itens.filter(i => i.status === 'aprovado').length
  const nAgendados = itens.filter(i => i.status === 'agendado').length
  const nEmCurso   = itens.filter(i => i.status === 'em_curso').length

  function fmt(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2 pb-2 border-b-2 border-slate-900">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-900">
            {supervisor}
          </span>
          <span className="text-xs text-slate-400">{itens.length} funcionário{itens.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {nAprovados > 0 && <span className="text-green-700 font-semibold">{nAprovados} aprovado{nAprovados !== 1 ? 's' : ''}</span>}
          {nAgendados > 0 && <span className="text-blue-700 font-semibold">{nAgendados} agendado{nAgendados !== 1 ? 's' : ''}</span>}
          {nEmCurso   > 0 && <span className="text-amber-700 font-semibold">{nEmCurso} em curso</span>}
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['Funcionário','Matr.','Cargo','Posto','Período Aquisitivo','Início','Retorno','Dias','Status'].map(h => (
                <th key={h} className="text-left px-3 py-2 font-semibold uppercase tracking-widest text-slate-400 text-[10px]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itens.map((item, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="px-3 py-2 font-semibold text-slate-900">{item.funcionario_nome}</td>
                <td className="px-3 py-2 text-slate-500">{item.registro}</td>
                <td className="px-3 py-2 text-slate-600">{item.cargo}</td>
                <td className="px-3 py-2 text-slate-600">{item.posto_nome}</td>
                <td className="px-3 py-2 text-slate-500">
                  {item.periodo_inicio && item.periodo_fim
                    ? `${fmt(item.periodo_inicio)} – ${fmt(item.periodo_fim)}`
                    : '—'}
                </td>
                <td className="px-3 py-2 text-center font-semibold text-slate-900">{fmt(item.data_inicio)}</td>
                <td className="px-3 py-2 text-center font-semibold text-slate-900">{fmt(item.data_fim)}</td>
                <td className="px-3 py-2 text-center font-bold text-slate-900">
                  {item.dias_utilizados ?? item.dias_direito ?? '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  <BadgeStatus status={item.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function RelatorioFeriasPage() {
  const defaultPeriodo = mesAtualDefault()
  const [mes, setMes] = useState(defaultPeriodo.mes)
  const [ano, setAno] = useState(defaultPeriodo.ano)
  const [supervisorId, setSupervisorId] = useState<string>('')
  const [supervisoresOpcoes, setSupervisoresOpcoes] = useState<SupervisorOption[]>([])
  const [supervisores, setSupervisores] = useState<SupervisorRelatorio[] | null>(null)
  const [mesAnoAtual, setMesAnoAtual]   = useState('')
  const [, setTotalRegistros] = useState(0)
  const [erro, setErro]       = useState<string | null>(null)
  const [isPending, start]    = useTransition()
  const [isDownloading, setIsDownloading] = useState(false)

  const anos = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - 1 + i)

  const diasPrazo    = diasParaPrazo(mes, ano)
  const prazoStr     = prazoRH(mes, ano)
  const prazoUrgente = diasPrazo >= 0 && diasPrazo <= 10

  // Carrega supervisores ativos ao montar
  useEffect(() => {
    buscarSupervisoresAtivos().then(setSupervisoresOpcoes)
  }, [])

  async function handleBuscar() {
    setErro(null)
    start(async () => {
      const result = await buscarFeriasParaRelatorio(
        mes,
        ano,
        supervisorId || undefined,
      )
      if (result.error) {
        setErro(result.error)
        setSupervisores(null)
      } else {
        setSupervisores(result.supervisores)
        setMesAnoAtual(result.mesAno)
        setTotalRegistros(result.totalRegistros)
      }
    })
  }

  async function handleDownload() {
    if (!supervisores) return
    setIsDownloading(true)
    try {
      const agora = new Date().toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }).replace(',', ' às')

      const nomeSupervisor = supervisorId
        ? supervisoresOpcoes.find(s => s.id === supervisorId)?.nome
        : undefined

      await downloadRelatorioFerias({
        supervisores,
        mesAno: mesAnoAtual,
        geradoEm: agora,
        geradoPor: nomeSupervisor ?? 'Coordenação',
      })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao gerar PDF')
    } finally {
      setIsDownloading(false)
    }
  }

  const total           = supervisores?.reduce((a, s) => a + s.itens.length, 0) ?? 0
  const totalAprovados  = supervisores?.reduce((a, s) => a + s.itens.filter(i => i.status === 'aprovado').length, 0) ?? 0
  const totalAgendados  = supervisores?.reduce((a, s) => a + s.itens.filter(i => i.status === 'agendado').length, 0) ?? 0

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Título */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Férias</p>
          <h1 className="text-2xl font-bold text-slate-900">Relação por Supervisor</h1>
          <p className="text-sm text-slate-500 mt-1">
            Férias com status <strong>Aprovado</strong>, <strong>Agendado</strong> ou <strong>Em Curso</strong> para o período selecionado.
          </p>
        </div>

        {/* Controles */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 flex flex-wrap items-end gap-4">

          {/* Mês */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Mês</label>
            <select
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              {MESES.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>

          {/* Ano */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Ano</label>
            <select
              value={ano}
              onChange={e => setAno(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              {anos.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Supervisor */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Supervisor</label>
            <select
              value={supervisorId}
              onChange={e => setSupervisorId(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 min-w-[200px]"
            >
              <option value="">Todos os supervisores</option>
              {supervisoresOpcoes.map(s => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>

          {/* Prazo RH */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
            prazoUrgente ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'
          }`}>
            <span className={prazoUrgente ? 'text-red-500' : 'text-slate-400'}>⏱</span>
            <span>
              Prazo RH: <strong>{prazoStr}</strong>
              {diasPrazo >= 0 && diasPrazo <= 30 && (
                <span className="ml-1">
                  ({diasPrazo === 0 ? 'hoje!' : `${diasPrazo} dia${diasPrazo !== 1 ? 's' : ''}`})
                </span>
              )}
            </span>
          </div>

          {/* Buscar */}
          <button
            onClick={handleBuscar}
            disabled={isPending}
            className="ml-auto bg-slate-900 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? 'Buscando...' : 'Buscar'}
          </button>

          {/* Baixar PDF — só aparece quando há resultados */}
          {supervisores && supervisores.length > 0 && (
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-2 bg-amber-500 text-slate-900 text-sm font-bold px-5 py-2 rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isDownloading ? 'Gerando PDF...' : '↓ Baixar PDF'}
            </button>
          )}
        </div>

        {/* Erro */}
        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-6">
            {erro}
          </div>
        )}

        {/* Resultado */}
        {supervisores !== null && (
          <>
            {supervisores.length > 0 && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Total',        value: total,          color: 'border-slate-900' },
                  { label: 'Aprovados',    value: totalAprovados, color: 'border-green-500' },
                  { label: 'Agendados',    value: totalAgendados, color: 'border-blue-500'  },
                  { label: 'Supervisores', value: supervisores.length, color: 'border-amber-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`bg-white border-t-4 ${color} border border-slate-200 rounded-xl px-5 py-4`}>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                    <p className="text-4xl font-bold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {supervisores.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                <p className="text-slate-400 text-sm">
                  Nenhuma féria encontrada para <strong>{MESES[mes - 1]} / {ano}</strong>
                  {supervisorId && supervisoresOpcoes.find(s => s.id === supervisorId) && (
                    <> — supervisor <strong>{supervisoresOpcoes.find(s => s.id === supervisorId)?.nome}</strong></>
                  )}
                </p>
                <p className="text-slate-300 text-xs mt-1">Status buscados: Aprovado, Agendado, Em Curso</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                {supervisores.map((sup, idx) => (
                  <TabelaSupervisor
                    key={idx}
                    supervisor={sup.supervisor_nome}
                    itens={sup.itens}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Estado inicial */}
        {supervisores === null && !isPending && (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <p className="text-slate-400 text-sm">
              Selecione o mês e ano e clique em <strong>Buscar</strong> para visualizar a relação.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
