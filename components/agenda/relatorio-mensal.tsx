'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Download, FileDown, Info, Minus, Search, TrendingDown, TrendingUp,
} from 'lucide-react'
import { addDias, addMeses, diaMes, numeroDia, rotuloMes } from '@/lib/agenda/datas'
import { exportToExcelSheets } from '@/lib/export-excel'
import { CUMPRIMENTO_MINIMO, gerarInsights } from '@/lib/agenda/relatorio-insights'
import type { RelatorioMensal as Dados, LinhaAlerta, LinhaSupervisor } from '@/app/(admin)/agenda/relatorio-actions'

const th = 'whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-500'
const td = 'px-3 py-2.5 text-sm text-slate-700'
const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm'

const corPct = (p: number | null) =>
  p === null ? 'text-slate-400' : p >= 80 ? 'text-emerald-600' : p >= CUMPRIMENTO_MINIMO ? 'text-amber-600' : 'text-rose-600'
const pctTxt = (p: number | null) => (p === null ? '—' : `${p}%`)

/** Variação em relação ao mês anterior. `bom` diz se subir é bom ou ruim. */
function Delta({ atual, anterior, unidade = '', bom = 'subir' }: { atual: number | null; anterior: number | null | undefined; unidade?: string; bom?: 'subir' | 'descer' }) {
  if (atual === null || anterior === null || anterior === undefined) return null
  const d = atual - anterior
  if (d === 0) return <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-slate-400"><Minus className="h-3 w-3" /> igual ao mês anterior</span>
  const bomSinal = bom === 'subir' ? d > 0 : d < 0
  const Icone = d > 0 ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${bomSinal ? 'text-emerald-600' : 'text-rose-600'}`}>
      <Icone className="h-3 w-3" /> {d > 0 ? '+' : ''}{d}{unidade} vs mês anterior
    </span>
  )
}

function Cabecalho({ titulo, contagem, detalhe }: { titulo: string; contagem?: number; detalhe?: string }) {
  return (
    <div className="mb-3">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
        {titulo}
        {contagem !== undefined && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{contagem}</span>}
      </p>
      {detalhe && <p className="mt-0.5 text-xs text-slate-400">{detalhe}</p>}
    </div>
  )
}

function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">{children}</p>
}

const SITUACOES = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'falta', rotulo: 'Faltas' },
  { id: 'alerta', rotulo: 'Atenção' },
  { id: 'sem_foto', rotulo: 'Sem foto' },
  { id: 'reposta', rotulo: 'Repostas' },
  { id: 'extra', rotulo: 'Extras' },
] as const

const COR_SITUACAO: Record<string, string> = {
  falta: 'bg-rose-100 text-rose-700',
  alerta: 'bg-amber-100 text-amber-700',
  sem_foto: 'bg-orange-100 text-orange-700',
  reposta: 'bg-teal-100 text-teal-700',
  extra: 'bg-slate-100 text-slate-600',
}

type Ordem = 'pior' | 'faltas' | 'nome'

export function RelatorioMensal({ dados, anterior }: { dados: Dados; anterior: Dados | null }) {
  const { mes, parcial, ateData, supervisores, postos, postosNaoVisitados, postosBaixaFrequencia, metaVisitasPosto, porFoco, porDia, replanejamentos, ocorrencias, totais } = dados
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [erroPdf, setErroPdf] = useState<string | null>(null)
  const [ordem, setOrdem] = useState<Ordem>('pior')
  const [filtroSit, setFiltroSit] = useState<string>('todas')
  const [filtroSup, setFiltroSup] = useState('')
  const [busca, setBusca] = useState('')
  const [limite, setLimite] = useState(40)
  const [verTodosInsights, setVerTodosInsights] = useState(false)

  const insights = useMemo(() => gerarInsights(dados, anterior), [dados, anterior])
  const anteriorSup = useMemo(() => new Map((anterior?.supervisores ?? []).map(s => [s.nome, s])), [anterior])

  const supsOrdenados = useMemo(() => {
    const l = [...supervisores]
    if (ordem === 'nome') return l.sort((a, b) => a.nome.localeCompare(b.nome))
    if (ordem === 'faltas') return l.sort((a, b) => b.faltas - a.faltas || a.nome.localeCompare(b.nome))
    // pior cumprimento primeiro; quem não tem visita planejada vai para o fim
    return l.sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101) || b.faltas - a.faltas)
  }, [supervisores, ordem])

  const contagemSit = useMemo(() => {
    const m: Record<string, number> = { todas: ocorrencias.length }
    for (const o of ocorrencias) m[o.chave] = (m[o.chave] ?? 0) + 1
    return m
  }, [ocorrencias])

  const ocorrenciasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return ocorrencias.filter((o: LinhaAlerta) =>
      (filtroSit === 'todas' || o.chave === filtroSit) &&
      (!filtroSup || o.supervisor === filtroSup) &&
      (!q || o.posto.toLowerCase().includes(q) || o.alertas.toLowerCase().includes(q) || o.justificativa.toLowerCase().includes(q)),
    )
  }, [ocorrencias, filtroSit, filtroSup, busca])

  const dias = useMemo(() => {
    const porData = new Map(porDia.map(d => [d.data, d]))
    const inicio = `${mes}-01`
    const out: { data: string; cumpridas: number; faltas: number; extras: number; atencao: number }[] = []
    for (let d = inicio; d <= ateData; d = addDias(d, 1)) {
      const dow = new Date(`${d}T12:00:00Z`).getUTCDay()
      if (dow === 0 || dow === 6) continue
      out.push(porData.get(d) ?? { data: d, cumpridas: 0, faltas: 0, extras: 0, atencao: 0 })
    }
    return out
  }, [porDia, mes, ateData])
  const maxDia = Math.max(1, ...dias.map(d => d.cumpridas + d.faltas + d.extras))

  const semDados = totais.planejadas === 0 && totais.extras === 0 && ocorrencias.length === 0

  const naoVisitadosPorSup = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const p of postosNaoVisitados) m.set(p.supervisor, [...(m.get(p.supervisor) ?? []), p.nome])
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [postosNaoVisitados])

  const replanPorSup = useMemo(() => {
    const m = new Map<string, typeof replanejamentos>()
    for (const r of replanejamentos) m.set(r.supervisor, [...(m.get(r.supervisor) ?? []), r])
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [replanejamentos])

  const kpis = [
    { label: 'Planejadas', valor: String(totais.planejadas), topo: 'border-t-blue-500', delta: <Delta atual={totais.planejadas} anterior={anterior?.totais.planejadas} /> },
    { label: 'Cumpridas', valor: String(totais.cumpridas), topo: 'border-t-emerald-500', delta: <Delta atual={totais.cumpridas} anterior={anterior?.totais.cumpridas} /> },
    { label: 'Faltas', valor: String(totais.faltas), topo: 'border-t-red-500', delta: <Delta atual={totais.faltas} anterior={anterior?.totais.faltas} bom="descer" /> },
    { label: 'Com atenção', valor: String(totais.atencao), topo: 'border-t-amber-500', delta: <Delta atual={totais.atencao} anterior={anterior?.totais.atencao} bom="descer" /> },
    { label: 'Sem foto', valor: String(totais.semFoto), topo: 'border-t-orange-500', delta: <Delta atual={totais.semFoto} anterior={anterior?.totais.semFoto} bom="descer" /> },
    { label: 'Extras', valor: String(totais.extras), topo: 'border-t-indigo-500', delta: <Delta atual={totais.extras} anterior={anterior?.totais.extras} /> },
  ]

  async function gerarPdf() {
    setErroPdf(null)
    setGerandoPdf(true)
    try {
      const { downloadRelatorioMensalPDF } = await import('./relatorio-mensal-pdf')
      await downloadRelatorioMensalPDF({ dados, anterior, insights })
    } catch {
      setErroPdf('Não foi possível gerar o PDF.')
    } finally {
      setGerandoPdf(false)
    }
  }

  function exportar() {
    exportToExcelSheets([
      {
        name: 'Resumo',
        data: [
          { indicador: 'Cumprimento (%)', valor: totais.pct, anterior: anterior?.totais.pct ?? null },
          { indicador: 'Planejadas', valor: totais.planejadas, anterior: anterior?.totais.planejadas ?? null },
          { indicador: 'Cumpridas', valor: totais.cumpridas, anterior: anterior?.totais.cumpridas ?? null },
          { indicador: 'Faltas', valor: totais.faltas, anterior: anterior?.totais.faltas ?? null },
          { indicador: 'Com atenção', valor: totais.atencao, anterior: anterior?.totais.atencao ?? null },
          { indicador: 'Sem foto', valor: totais.semFoto, anterior: anterior?.totais.semFoto ?? null },
          { indicador: 'Extras', valor: totais.extras, anterior: anterior?.totais.extras ?? null },
        ],
        columns: [
          { label: 'Indicador', value: r => r.indicador },
          { label: rotuloMes(mes), value: r => r.valor },
          { label: 'Mês anterior', value: r => r.anterior },
        ],
      },
      {
        name: 'Pontos de atenção',
        data: insights,
        columns: [
          { label: 'Nível', value: i => (i.nivel === 'alto' ? 'Alto' : i.nivel === 'medio' ? 'Médio' : 'Informativo') },
          { label: 'Supervisor', value: i => i.supervisor ?? 'Geral' },
          { label: 'Ponto de atenção', value: i => i.texto },
        ],
      },
      {
        name: 'Supervisores',
        data: supervisores,
        columns: [
          { label: 'Supervisor', value: s => s.nome },
          { label: 'Cumprimento (%)', value: s => s.pct },
          { label: 'Cumprimento mês anterior (%)', value: s => anteriorSup.get(s.nome)?.pct ?? null },
          { label: 'Planejadas', value: s => s.planejadas },
          { label: 'Cumpridas', value: s => s.cumpridas },
          { label: 'Repostas', value: s => s.repostas },
          { label: 'Faltas', value: s => s.faltas },
          { label: 'Extras', value: s => s.extras },
          { label: 'Com atenção', value: s => s.atencao },
          { label: 'Sem foto', value: s => s.semFoto },
          { label: 'Fora do raio', value: s => s.foraRaio },
          { label: 'Tempo médio (min)', value: s => s.tempoMedioMin },
          { label: 'Replanejamentos', value: s => s.replanejamentos },
          { label: 'Semanas publicadas', value: s => s.semanasPublicadas },
          { label: 'Semanas em rascunho', value: s => s.semanasRascunho },
          { label: 'Semanas sem agenda', value: s => s.semanasSemAgenda },
          { label: 'Postos sem visita no mês', value: s => s.postosSemVisita },
        ],
      },
      {
        name: 'Por foco',
        data: porFoco,
        columns: [
          { label: 'Foco', value: f => f.foco },
          { label: 'Planejadas', value: f => f.planejadas },
          { label: 'Cumpridas', value: f => f.cumpridas },
          { label: 'Faltas', value: f => f.faltas },
          { label: 'Sem foto', value: f => f.semFoto },
          { label: 'Cumprimento (%)', value: f => f.pct },
        ],
      },
      {
        name: 'Postos',
        data: postos,
        columns: [
          { label: 'Posto', value: p => p.nome },
          { label: 'Supervisor', value: p => p.supervisor },
          { label: 'Planejadas', value: p => p.planejadas },
          { label: 'Cumpridas', value: p => p.cumpridas },
          { label: 'Faltas', value: p => p.faltas },
          { label: 'Extras', value: p => p.extras },
          { label: 'Última visita', value: p => p.ultimaVisita ?? '' },
        ],
      },
      {
        name: 'Baixa frequência',
        data: postosBaixaFrequencia,
        columns: [
          { label: 'Posto', value: p => p.nome },
          { label: 'Supervisor', value: p => p.supervisor },
          { label: 'Dias com visita', value: p => p.visitas },
          { label: 'Meta no mês', value: () => metaVisitasPosto },
        ],
      },
      {
        name: 'Postos sem visita',
        data: postosNaoVisitados,
        columns: [
          { label: 'Posto', value: p => p.nome },
          { label: 'Supervisor', value: p => p.supervisor },
        ],
      },
      {
        name: 'Ocorrências',
        data: ocorrencias,
        columns: [
          { label: 'Data', value: o => o.data, asText: true },
          { label: 'Supervisor', value: o => o.supervisor },
          { label: 'Posto', value: o => o.posto },
          { label: 'Situação', value: o => o.status },
          { label: 'Sinais', value: o => o.alertas },
          { label: 'Justificativa', value: o => o.justificativa },
        ],
      },
      {
        name: 'Replanejamentos',
        data: replanejamentos,
        columns: [
          { label: 'Data', value: r => r.data, asText: true },
          { label: 'Supervisor', value: r => r.supervisor },
          { label: 'Foco', value: r => r.foco },
          { label: 'Motivo', value: r => r.motivo },
        ],
      },
    ], `agenda-supervisores-${mes}.xlsx`)
  }

  const insightsVisiveis = verTodosInsights ? insights : insights.slice(0, 6)
  const barra = (s: LinhaSupervisor) => {
    const total = Math.max(1, s.planejadas)
    return { ok: (s.cumpridas / total) * 100, falta: (s.faltas / total) * 100, foto: (s.semFoto / total) * 100 }
  }

  return (
    <div className="space-y-5 print:space-y-3">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Agenda dos supervisores</p>
          <h1 className="text-2xl font-bold text-slate-900">Relatório mensal · <span className="capitalize">{rotuloMes(mes)}</span></h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            Cumprimento das visitas e deficiências a corrigir.
            {parcial && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                Mês em andamento · dados até {diaMes(ateData)}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {erroPdf && <span className="text-xs font-medium text-red-600">{erroPdf}</span>}
          <button type="button" onClick={exportar}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Download className="h-4 w-4" /> Excel
          </button>
          <button type="button" onClick={gerarPdf} disabled={gerandoPdf}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50">
            <FileDown className="h-4 w-4" /> {gerandoPdf ? 'Gerando…' : 'PDF'}
          </button>
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-900 p-1 text-white">
            <Link href={`/agenda/relatorio?mes=${addMeses(mes, -1)}`} className="rounded-lg p-2 hover:bg-white/10" aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></Link>
            <span className="min-w-24 text-center text-sm font-bold">{mes.split('-').reverse().join('/')}</span>
            <Link href={`/agenda/relatorio?mes=${addMeses(mes, 1)}`} className="rounded-lg p-2 hover:bg-white/10" aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </div>

      {semDados && (
        <Vazio>Sem agenda nem check-ins neste mês.</Vazio>
      )}

      {/* Resumo executivo */}
      <section className={`${card} border-t-4 border-t-emerald-500 p-5`}>
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Cumprimento geral</p>
            <p className={`mt-1 text-6xl font-black leading-none ${corPct(totais.pct)}`}>{pctTxt(totais.pct)}</p>
            <p className="mt-2 text-sm text-slate-500">{totais.cumpridas} de {totais.planejadas} visitas planejadas</p>
            <div className="mt-1"><Delta atual={totais.pct} anterior={anterior?.totais.pct} unidade=" pp" /></div>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100" title={`${totais.cumpridas} cumpridas · ${totais.faltas} faltas · ${totais.semFoto} sem foto`}>
              <div className="bg-emerald-500" style={{ width: `${totais.planejadas ? (totais.cumpridas / totais.planejadas) * 100 : 0}%` }} />
              <div className="bg-orange-400" style={{ width: `${totais.planejadas ? (totais.semFoto / totais.planejadas) * 100 : 0}%` }} />
              <div className="bg-rose-500" style={{ width: `${totais.planejadas ? (totais.faltas / totais.planejadas) * 100 : 0}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              <span className="text-emerald-600">●</span> cumpridas <span className="text-orange-500">●</span> sem foto <span className="text-rose-500">●</span> faltas
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {kpis.map(k => (
              <div key={k.label} className={`rounded-xl border border-slate-200 border-t-4 bg-white p-3 ${k.topo}`}>
                <p className="text-3xl font-black text-slate-900">{k.valor}</p>
                <p className="text-[11px] uppercase tracking-widest text-slate-500">{k.label}</p>
                <div className="mt-1 min-h-4">{k.delta}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pontos de atenção */}
      <section className={`${card} border-t-4 border-t-rose-500 p-5`}>
        <Cabecalho titulo="Pontos de atenção" contagem={insights.length} detalhe="Gerados automaticamente dos números do mês: o que precisa de ação da coordenação." />
        {insights.length === 0 ? (
          <Vazio>Nenhum ponto de atenção neste mês. 👏</Vazio>
        ) : (
          <>
            <ul className="grid gap-2 lg:grid-cols-2">
              {insightsVisiveis.map((i, idx) => (
                <li key={idx} className={`flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm ${
                  i.nivel === 'alto' ? 'bg-rose-50 text-rose-900' : i.nivel === 'medio' ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-700'
                }`}>
                  {i.nivel === 'info' ? <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> : <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${i.nivel === 'alto' ? 'text-rose-500' : 'text-amber-500'}`} />}
                  <span>{i.supervisor && <b>{i.supervisor} </b>}{i.texto}</span>
                </li>
              ))}
            </ul>
            {insights.length > 6 && (
              <button type="button" onClick={() => setVerTodosInsights(v => !v)}
                className="mt-3 text-xs font-semibold text-slate-500 hover:text-slate-900 print:hidden">
                {verTodosInsights ? 'Mostrar menos' : `Ver todos os ${insights.length} pontos`}
              </button>
            )}
          </>
        )}
      </section>

      {/* Linha do tempo */}
      {dias.length > 0 && (
        <section className={`${card} border-t-4 border-t-blue-500 p-5`}>
          <Cabecalho titulo="Visitas por dia útil" detalhe="Cada coluna é um dia: verde = cumpridas, vermelho = faltas, cinza = extras." />
          <div className="flex h-28 items-end gap-1">
            {dias.map(d => {
              const altura = (n: number) => `${(n / maxDia) * 100}%`
              return (
                <div key={d.data} className="flex h-full min-w-0 flex-1 flex-col justify-end"
                  title={`${diaMes(d.data)}: ${d.cumpridas} cumpridas · ${d.faltas} faltas · ${d.extras} extras${d.atencao ? ` · ${d.atencao} com atenção` : ''}`}>
                  <div className="bg-slate-300" style={{ height: altura(d.extras) }} />
                  <div className="bg-rose-400" style={{ height: altura(d.faltas) }} />
                  <div className="rounded-t bg-emerald-500" style={{ height: altura(d.cumpridas) }} />
                </div>
              )
            })}
          </div>
          <div className="mt-1 flex gap-1">
            {dias.map(d => <span key={d.data} className="min-w-0 flex-1 text-center text-[10px] text-slate-400">{numeroDia(d.data)}</span>)}
          </div>
        </section>
      )}

      {/* Supervisores */}
      <section className={`${card} overflow-hidden border-t-4 border-t-blue-500`}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
          <Cabecalho titulo="Desempenho por supervisor" contagem={supervisores.length} />
          <label className="flex items-center gap-2 text-xs text-slate-500 print:hidden">
            Ordenar por
            <select value={ordem} onChange={e => setOrdem(e.target.value as Ordem)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
              <option value="pior">Pior cumprimento</option>
              <option value="faltas">Mais faltas</option>
              <option value="nome">Nome</option>
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="border-b border-slate-100 bg-slate-50/60">
              <tr>
                <th className={th}>Supervisor</th>
                <th className={th} title="Visitas cumpridas ÷ planejadas vencidas">Cumprimento</th>
                <th className={th}>Plan.</th>
                <th className={th}>Faltas</th>
                <th className={th} title="Check-ins em posto fora do plano">Extras</th>
                <th className={th} title="Cumpridas com sinal de atenção: fora do raio, permanência curta, GPS ruim">Atenção</th>
                <th className={th}>Sem foto</th>
                <th className={th}>Tempo méd.</th>
                <th className={th}>Replan.</th>
                <th className={th} title="Semanas do mês: publicadas / em rascunho / sem agenda">Agenda</th>
                <th className={th} title="Postos do supervisor sem nenhuma visita no mês">Postos s/ visita</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {supsOrdenados.map(s => {
                const b = barra(s)
                const ant = anteriorSup.get(s.nome)
                return (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className={`${td} font-semibold text-slate-900`}>
                      <Link href={`/agenda?supervisor=${s.id}`} className="hover:underline">{s.nome}</Link>
                    </td>
                    <td className={td}>
                      <div className="flex items-center gap-2">
                        <span className={`w-10 text-right font-bold ${corPct(s.pct)}`}>{pctTxt(s.pct)}</span>
                        <div className="flex h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div className="bg-emerald-500" style={{ width: `${b.ok}%` }} />
                          <div className="bg-orange-400" style={{ width: `${b.foto}%` }} />
                          <div className="bg-rose-500" style={{ width: `${b.falta}%` }} />
                        </div>
                      </div>
                      <div className="mt-0.5 pl-12"><Delta atual={s.pct} anterior={ant?.pct} unidade=" pp" /></div>
                    </td>
                    <td className={td}>{s.planejadas}</td>
                    <td className={`${td} ${s.faltas ? 'font-bold text-rose-600' : 'text-slate-400'}`}>{s.faltas}</td>
                    <td className={td}>{s.extras}</td>
                    <td className={`${td} ${s.atencao ? 'font-semibold text-amber-600' : 'text-slate-400'}`}>{s.atencao}</td>
                    <td className={`${td} ${s.semFoto ? 'font-semibold text-orange-600' : 'text-slate-400'}`}>{s.semFoto}</td>
                    <td className={td}>{s.tempoMedioMin !== null ? `${s.tempoMedioMin} min` : '—'}</td>
                    <td className={td}>{s.replanejamentos}</td>
                    <td className={td}>
                      <span className="text-emerald-600">{s.semanasPublicadas}</span>
                      <span className="text-slate-300"> / </span>
                      <span className="text-amber-600">{s.semanasRascunho}</span>
                      <span className="text-slate-300"> / </span>
                      <span className={s.semanasSemAgenda ? 'font-bold text-rose-600' : 'text-slate-400'}>{s.semanasSemAgenda}</span>
                    </td>
                    <td className={`${td} ${s.postosSemVisita ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>{s.postosSemVisita}</td>
                  </tr>
                )
              })}
              {supervisores.length === 0 && <tr><td className={td} colSpan={11}>Nenhum supervisor ativo.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Focos e postos com faltas */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={`${card} overflow-hidden border-t-4 border-t-teal-500`}>
          <div className="px-5 pt-4"><Cabecalho titulo="Cumprimento por tipo de foco" detalhe="Do pior para o melhor." /></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px]">
              <thead className="border-b border-slate-100 bg-slate-50/60"><tr>{['Foco', 'Plan.', 'Faltas', 'Sem foto', 'Cumprim.'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {porFoco.map(f => (
                  <tr key={f.foco}>
                    <td className={`${td} font-semibold`}>{f.foco}</td>
                    <td className={td}>{f.planejadas}</td>
                    <td className={`${td} ${f.faltas ? 'font-bold text-rose-600' : 'text-slate-400'}`}>{f.faltas}</td>
                    <td className={`${td} ${f.semFoto ? 'text-orange-600' : 'text-slate-400'}`}>{f.semFoto}</td>
                    <td className={`${td} font-bold ${corPct(f.pct)}`}>{pctTxt(f.pct)}</td>
                  </tr>
                ))}
                {porFoco.length === 0 && <tr><td className={td} colSpan={5}>Sem visitas planejadas vencidas no mês.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${card} border-t-4 border-t-red-500 p-5`}>
          <Cabecalho titulo="Postos com mais faltas" detalhe="Visitas planejadas sem check-in no mês." />
          {postos.every(p => p.faltas === 0) ? (
            <Vazio>Nenhuma falta no mês.</Vazio>
          ) : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {postos.filter(p => p.faltas > 0).slice(0, 15).map(p => (
                <li key={`${p.supervisor}|${p.postoId}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0"><b className="block truncate text-slate-800">{p.nome}</b><span className="text-xs text-slate-500">{p.supervisor}</span></span>
                  <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">{p.faltas} de {p.planejadas}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Cobertura dos postos */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={`${card} border-t-4 border-t-orange-500 p-5`}>
          <Cabecalho titulo="Baixa frequência" contagem={postosBaixaFrequencia.length} detalhe={`Postos visitados em menos de ${metaVisitasPosto} dias no mês.`} />
          {postosBaixaFrequencia.length === 0 ? (
            <Vazio>Nenhum posto abaixo da meta.</Vazio>
          ) : (
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
              {postosBaixaFrequencia.map(p => (
                <li key={`${p.supervisor}|${p.postoId}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0"><b className="block truncate text-slate-800">{p.nome}</b><span className="text-xs text-slate-500">{p.supervisor}</span></span>
                  <span className="shrink-0 text-xs font-bold text-orange-600">{p.visitas} de {metaVisitasPosto}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${card} border-t-4 border-t-purple-500 p-5`}>
          <Cabecalho titulo="Postos sem nenhuma visita" contagem={postosNaoVisitados.length} detalhe="Agrupados por supervisor. Abra para ver a lista." />
          {naoVisitadosPorSup.length === 0 ? (
            <Vazio>Todos os postos tiveram visita.</Vazio>
          ) : (
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {naoVisitadosPorSup.map(([sup, lista]) => (
                <details key={sup} className="group rounded-lg bg-slate-50 px-3 py-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-800">
                    {sup}
                    <span className="flex items-center gap-1.5 text-xs text-purple-700">
                      {lista.length} {lista.length === 1 ? 'posto' : 'postos'}
                      <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
                    </span>
                  </summary>
                  <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                    {lista.map(n => <li key={n}>• {n}</li>)}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Ocorrências */}
      <section className={`${card} overflow-hidden border-t-4 border-t-amber-500`}>
        <div className="space-y-3 px-5 pt-4">
          <Cabecalho titulo="Ocorrências" contagem={ocorrenciasFiltradas.length} detalhe="Cada falta, alerta, visita sem foto, reposição e visita extra do mês." />
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {SITUACOES.map(s => (
              <button key={s.id} type="button" onClick={() => { setFiltroSit(s.id); setLimite(40) }}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  filtroSit === s.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                }`}>
                {s.rotulo} <span className="opacity-60">{contagemSit[s.id] ?? 0}</span>
              </button>
            ))}
            <select value={filtroSup} onChange={e => { setFiltroSup(e.target.value); setLimite(40) }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700">
              <option value="">Todos os supervisores</option>
              {supervisores.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
            </select>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input value={busca} onChange={e => { setBusca(e.target.value); setLimite(40) }} placeholder="Buscar posto ou texto…"
                className="w-52 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-xs outline-none focus:border-slate-400" />
            </div>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="border-y border-slate-100 bg-slate-50/60"><tr>{['Data', 'Supervisor', 'Posto', 'Situação', 'Sinais / justificativa'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {ocorrenciasFiltradas.slice(0, limite).map((o, i) => (
                <tr key={i} className="align-top">
                  <td className={`${td} whitespace-nowrap`}>{diaMes(o.data)}</td>
                  <td className={td}>{o.supervisor}</td>
                  <td className={td}>{o.posto}</td>
                  <td className={td}><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${COR_SITUACAO[o.chave] ?? 'bg-slate-100 text-slate-600'}`}>{o.status}</span></td>
                  <td className={`${td} text-xs`}>
                    {o.alertas || <span className="text-slate-300">—</span>}
                    {o.justificativa && <span className="mt-0.5 block text-slate-500">Justificativa: {o.justificativa}</span>}
                  </td>
                </tr>
              ))}
              {ocorrenciasFiltradas.length === 0 && <tr><td className={td} colSpan={5}>Nenhuma ocorrência com esses filtros.</td></tr>}
            </tbody>
          </table>
        </div>
        {ocorrenciasFiltradas.length > limite && (
          <div className="border-t border-slate-100 px-5 py-3 text-center print:hidden">
            <button type="button" onClick={() => setLimite(l => l + 60)} className="text-xs font-semibold text-slate-600 hover:text-slate-900">
              Mostrar mais ({ocorrenciasFiltradas.length - limite} restantes)
            </button>
          </div>
        )}
      </section>

      {/* Replanejamentos */}
      <section className={`${card} border-t-4 border-t-indigo-500 p-5`}>
        <Cabecalho titulo="Replanejamentos" contagem={replanejamentos.length} detalhe="Mudanças em agenda já publicada, com o motivo informado." />
        {replanPorSup.length === 0 ? (
          <Vazio>Nenhum replanejamento no mês.</Vazio>
        ) : (
          <div className="space-y-1.5">
            {replanPorSup.map(([sup, lista]) => (
              <details key={sup} className="group rounded-lg bg-slate-50 px-3 py-2">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-800">
                  {sup}
                  <span className="flex items-center gap-1.5 text-xs text-indigo-700">
                    {lista.length} {lista.length === 1 ? 'mudança' : 'mudanças'}
                    <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
                  </span>
                </summary>
                <ul className="mt-2 divide-y divide-slate-200/70">
                  {lista.map((r, i) => (
                    <li key={i} className="py-1.5 text-sm">
                      <span className="text-xs text-slate-500">{diaMes(r.data)} · {r.foco}</span>
                      <span className="block text-slate-700">{r.motivo || 'Sem motivo informado'}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </section>

      {/* Metodologia */}
      <details className={`${card} px-5 py-3 print:hidden`}>
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-widest text-slate-500">Como os números são calculados</summary>
        <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
          <li><b>Planejada:</b> visita de um bloco de agenda <u>publicada</u> cujo dia já passou. Agenda em rascunho e dias futuros não entram.</li>
          <li><b>Cumprida:</b> teve check-in no posto no dia (ou foi reposta por visita extra no mesmo posto na mesma semana). Foco que exige foto só conta com a foto anexada.</li>
          <li><b>Falta:</b> planejada sem nenhum check-in de entrada.</li>
          <li><b>Atenção:</b> cumprida com sinal a conferir: fora do raio, GPS impreciso, permanência abaixo de 10 min, deslocamento improvável ou coordenada idêntica à de outro dia.</li>
          <li><b>Extra:</b> check-in em posto que não estava planejado naquele dia. Na sede, a foto é sempre obrigatória.</li>
          <li><b>Baixa frequência:</b> posto do supervisor com visita em menos de {metaVisitasPosto} dias no mês (meta ajustável no código).</li>
          <li>Comparações &quot;vs mês anterior&quot; usam as mesmas regras do mês anterior completo.</li>
        </ul>
      </details>
    </div>
  )
}
