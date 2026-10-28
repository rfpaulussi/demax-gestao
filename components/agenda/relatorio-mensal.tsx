'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { addMeses, diaMes, rotuloMes } from '@/lib/agenda/datas'
import { exportToExcelSheets } from '@/lib/export-excel'
import type { RelatorioMensal as Dados } from '@/app/(admin)/agenda/relatorio-actions'

const corPct = (p: number | null) =>
  p === null ? 'text-slate-400' : p >= 80 ? 'text-emerald-600' : p >= 50 ? 'text-amber-600' : 'text-rose-600'

const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-slate-500'
const td = 'px-3 py-2 text-sm text-slate-700'

export function RelatorioMensal({ dados }: { dados: Dados }) {
  const { mes, supervisores, postos, postosNaoVisitados, postosBaixaFrequencia, metaVisitasPosto, porFoco, replanejamentos, ocorrencias, totais } = dados
  const pctTxt = (p: number | null) => (p === null ? '—' : `${p}%`)

  const kpis = [
    { label: 'Cumprimento', valor: pctTxt(totais.pct), topo: 'border-t-emerald-500' },
    { label: 'Planejadas', valor: totais.planejadas, topo: 'border-t-blue-500' },
    { label: 'Faltas', valor: totais.faltas, topo: 'border-t-red-500' },
    { label: 'Com atenção', valor: totais.atencao, topo: 'border-t-amber-500' },
    { label: 'Sem foto', valor: totais.semFoto, topo: 'border-t-orange-500' },
    { label: 'Extras', valor: totais.extras, topo: 'border-t-indigo-500' },
  ]

  function exportar() {
    exportToExcelSheets([
      {
        name: 'Supervisores',
        data: supervisores,
        columns: [
          { label: 'Supervisor', value: s => s.nome },
          { label: 'Cumprimento (%)', value: s => s.pct },
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
        name: 'Postos sem visita',
        data: postosNaoVisitados,
        columns: [
          { label: 'Posto', value: p => p.nome },
          { label: 'Supervisor', value: p => p.supervisor },
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatório mensal da agenda</h1>
          <p className="text-sm text-slate-500">Cumprimento das visitas e deficiências de {rotuloMes(mes)}.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportar}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">
            <Download className="h-4 w-4" /> Excel
          </button>
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-900 p-1 text-white">
            <Link href={`/agenda/relatorio?mes=${addMeses(mes, -1)}`} className="rounded-lg p-2 hover:bg-white/10" aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></Link>
            <span className="min-w-32 text-center text-sm font-bold">{mes.split('-').reverse().join('/')}</span>
            <Link href={`/agenda/relatorio?mes=${addMeses(mes, 1)}`} className="rounded-lg p-2 hover:bg-white/10" aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {kpis.map(k => (
          <div key={k.label} className={`rounded-xl border border-slate-200 border-t-4 bg-white p-4 shadow-sm ${k.topo}`}>
            <p className="text-3xl font-black text-slate-900">{k.valor}</p>
            <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">{k.label}</p>
          </div>
        ))}
      </div>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 border-t-4 border-t-blue-500 bg-white shadow-sm">
        <p className="px-4 pt-3 text-xs font-bold uppercase tracking-widest text-slate-500">Por supervisor</p>
        <table className="w-full min-w-[900px]">
          <thead><tr>
            {['Supervisor', 'Cumprim.', 'Plan.', 'Faltas', 'Extras', 'Atenção', 'Sem foto', 'Fora raio', 'Tempo méd.', 'Replan.', 'Semanas pub/rasc/sem', 'Postos s/ visita'].map(h => <th key={h} className={th}>{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {supervisores.map(s => (
              <tr key={s.id}>
                <td className={`${td} font-semibold`}>{s.nome}</td>
                <td className={`${td} font-bold ${corPct(s.pct)}`}>{pctTxt(s.pct)}</td>
                <td className={td}>{s.planejadas}</td>
                <td className={`${td} ${s.faltas ? 'font-bold text-rose-600' : ''}`}>{s.faltas}</td>
                <td className={td}>{s.extras}</td>
                <td className={`${td} ${s.atencao ? 'text-amber-600' : ''}`}>{s.atencao}</td>
                <td className={`${td} ${s.semFoto ? 'text-orange-600' : ''}`}>{s.semFoto}</td>
                <td className={td}>{s.foraRaio}</td>
                <td className={td}>{s.tempoMedioMin !== null ? `${s.tempoMedioMin} min` : '—'}</td>
                <td className={td}>{s.replanejamentos}</td>
                <td className={td}>{s.semanasPublicadas}/{s.semanasRascunho}/<span className={s.semanasSemAgenda ? 'font-bold text-rose-600' : ''}>{s.semanasSemAgenda}</span></td>
                <td className={`${td} ${s.postosSemVisita ? 'font-bold text-rose-600' : ''}`}>{s.postosSemVisita}</td>
              </tr>
            ))}
            {supervisores.length === 0 && <tr><td className={td} colSpan={12}>Nenhum supervisor ativo.</td></tr>}
          </tbody>
        </table>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 border-t-4 border-t-red-500 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Postos com mais faltas</p>
          <ul className="divide-y divide-slate-100">
            {postos.filter(p => p.faltas > 0).slice(0, 15).map(p => (
              <li key={`${p.supervisor}|${p.postoId}`} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span><b>{p.nome}</b> <span className="text-xs text-slate-500">· {p.supervisor}</span></span>
                <span className="text-xs font-bold text-rose-600">{p.faltas} de {p.planejadas}</span>
              </li>
            ))}
            {postos.every(p => p.faltas === 0) && <li className="py-2 text-sm text-slate-500">Nenhuma falta no mês.</li>}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 border-t-4 border-t-purple-500 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
            Postos sem nenhuma visita no mês <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] text-purple-700">{postosNaoVisitados.length}</span>
          </p>
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {postosNaoVisitados.map(p => (
              <li key={`${p.supervisor}|${p.postoId}`} className="py-1.5 text-sm"><b>{p.nome}</b> <span className="text-xs text-slate-500">· {p.supervisor}</span></li>
            ))}
            {postosNaoVisitados.length === 0 && <li className="py-2 text-sm text-slate-500">Todos os postos tiveram visita.</li>}
          </ul>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 border-t-4 border-t-orange-500 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
            Baixa frequência <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] text-orange-700">{postosBaixaFrequencia.length}</span>
          </p>
          <p className="mb-2 text-[11px] text-slate-500">Postos visitados, mas com menos de {metaVisitasPosto} dias de visita no mês.</p>
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {postosBaixaFrequencia.map(p => (
              <li key={`${p.supervisor}|${p.postoId}`} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span><b>{p.nome}</b> <span className="text-xs text-slate-500">· {p.supervisor}</span></span>
                <span className="text-xs font-bold text-orange-600">{p.visitas} de {metaVisitasPosto}</span>
              </li>
            ))}
            {postosBaixaFrequencia.length === 0 && <li className="py-2 text-sm text-slate-500">Nenhum posto abaixo da meta.</li>}
          </ul>
        </section>

        <section className="overflow-x-auto rounded-2xl border border-slate-200 border-t-4 border-t-teal-500 bg-white shadow-sm">
          <p className="px-4 pt-3 text-xs font-bold uppercase tracking-widest text-slate-500">Cumprimento por tipo de foco</p>
          <table className="w-full min-w-[420px]">
            <thead><tr>{['Foco', 'Plan.', 'Faltas', 'Sem foto', 'Cumprim.'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {porFoco.map(f => (
                <tr key={f.foco}>
                  <td className={`${td} font-semibold`}>{f.foco}</td>
                  <td className={td}>{f.planejadas}</td>
                  <td className={`${td} ${f.faltas ? 'font-bold text-rose-600' : ''}`}>{f.faltas}</td>
                  <td className={`${td} ${f.semFoto ? 'text-orange-600' : ''}`}>{f.semFoto}</td>
                  <td className={`${td} font-bold ${corPct(f.pct)}`}>{pctTxt(f.pct)}</td>
                </tr>
              ))}
              {porFoco.length === 0 && <tr><td className={td} colSpan={5}>Sem visitas planejadas vencidas no mês.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 border-t-4 border-t-amber-500 bg-white shadow-sm">
        <p className="px-4 pt-3 text-xs font-bold uppercase tracking-widest text-slate-500">
          Ocorrências <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">{ocorrencias.length}</span>
        </p>
        <table className="w-full min-w-[800px]">
          <thead><tr>{['Data', 'Supervisor', 'Posto', 'Situação', 'Sinais / justificativa'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {ocorrencias.map((o, i) => (
              <tr key={i}>
                <td className={td}>{diaMes(o.data)}</td>
                <td className={td}>{o.supervisor}</td>
                <td className={td}>{o.posto}</td>
                <td className={`${td} font-semibold`}>{o.status}</td>
                <td className={`${td} text-xs`}>{o.alertas}{o.justificativa && <span className="block text-slate-500">Justificativa: {o.justificativa}</span>}</td>
              </tr>
            ))}
            {ocorrencias.length === 0 && <tr><td className={td} colSpan={5}>Sem ocorrências no mês.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-slate-200 border-t-4 border-t-indigo-500 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
          Replanejamentos <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] text-indigo-700">{replanejamentos.length}</span>
        </p>
        <ul className="divide-y divide-slate-100">
          {replanejamentos.map((r, i) => (
            <li key={i} className="py-1.5 text-sm">
              <b>{r.supervisor}</b> <span className="text-xs text-slate-500">· {diaMes(r.data)} · {r.foco}</span>
              <span className="block text-xs text-slate-600">{r.motivo || 'Sem motivo informado'}</span>
            </li>
          ))}
          {replanejamentos.length === 0 && <li className="py-2 text-sm text-slate-500">Nenhum replanejamento no mês.</li>}
        </ul>
      </section>
    </div>
  )
}
