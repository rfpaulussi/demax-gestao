'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FileSpreadsheet } from 'lucide-react'
import { exportToExcel } from '@/lib/export-excel'
import { STATUS_PENDENTES, SITUACOES_SEM_FERIAS, diasAteLimite, prazoLabel } from '@/lib/ferias/prazo'
import { buscarFeriasLista, type FeriasListaItem } from '../actions'

function isoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function fmt(str: string | null): string {
  if (!str) return '—'
  const [y, m, d] = str.split('-')
  return `${d}/${m}/${y}`
}

function mesLabel(chave: string): string {
  const [y, m] = chave.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(m) - 1]}/${y.slice(2)}`
}

const STATUS_LABEL: Record<string, string> = {
  disponivel: 'Sem agendamento',
  agendado: 'Agendado',
  aprovado: 'Aprovado',
}

type Linha = {
  supervisor: string
  vencidos: number
  porMes: Record<string, number>
  total: number
  dias: number
  semAgendamento: number
  itens: FeriasListaItem[]
}

export default function PanoramaFeriasPage() {
  const hojeIso = isoLocal(new Date())
  const [ferias, setFerias] = useState<FeriasListaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [de, setDe] = useState(hojeIso)
  const [ate, setAte] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 3)
    return isoLocal(d)
  })
  const [incluirVencidos, setIncluirVencidos] = useState(true)
  const [secretaria, setSecretaria] = useState('todas')
  const [aberto, setAberto] = useState<string | null>(null)

  useEffect(() => {
    buscarFeriasLista().then(f => { setFerias(f); setLoading(false) })
  }, [])

  const secretarias = useMemo(
    () => Array.from(new Set(ferias.map(f => f.secretaria).filter(s => s && s !== '—'))).sort(),
    [ferias]
  )

  // Períodos ainda não gozados, de funcionários que seguem no quadro
  const pendentes = useMemo(
    () => ferias.filter(f =>
      STATUS_PENDENTES.includes(f.status) &&
      !SITUACOES_SEM_FERIAS.includes(f.funcionario_status ?? '') &&
      f.limite_gozo &&
      (secretaria === 'todas' || f.secretaria === secretaria)
    ),
    [ferias, secretaria]
  )

  const meses = useMemo(() => {
    const out: string[] = []
    if (!de || !ate || de > ate) return out
    const [y1, m1] = de.split('-').map(Number)
    const [y2, m2] = ate.split('-').map(Number)
    let y = y1, m = m1
    while ((y < y2 || (y === y2 && m <= m2)) && out.length < 24) {
      out.push(`${y}-${String(m).padStart(2, '0')}`)
      m++
      if (m > 12) { m = 1; y++ }
    }
    return out
  }, [de, ate])

  const linhas = useMemo(() => {
    const mapa = new Map<string, Linha>()
    for (const f of pendentes) {
      const lim = f.limite_gozo!
      const vencido = lim < hojeIso
      const naJanela = lim >= de && lim <= ate
      if (!(naJanela || (incluirVencidos && vencido))) continue

      const sup = f.supervisor_nome
      if (!mapa.has(sup)) {
        mapa.set(sup, { supervisor: sup, vencidos: 0, porMes: {}, total: 0, dias: 0, semAgendamento: 0, itens: [] })
      }
      const l = mapa.get(sup)!
      if (vencido) l.vencidos++
      else {
        const chave = lim.slice(0, 7)
        l.porMes[chave] = (l.porMes[chave] ?? 0) + 1
      }
      l.total++
      l.dias += f.dias_direito ?? 0
      if (f.status === 'disponivel') l.semAgendamento++
      l.itens.push(f)
    }
    const lista = Array.from(mapa.values())
    for (const l of lista) l.itens.sort((a, b) => (a.limite_gozo ?? '').localeCompare(b.limite_gozo ?? ''))
    return lista.sort((a, b) => a.supervisor.localeCompare(b.supervisor))
  }, [pendentes, de, ate, incluirVencidos, hojeIso])

  const totais = useMemo(() => {
    const t = { vencidos: 0, porMes: {} as Record<string, number>, total: 0, dias: 0, semAgendamento: 0 }
    for (const l of linhas) {
      t.vencidos += l.vencidos
      t.total += l.total
      t.dias += l.dias
      t.semAgendamento += l.semAgendamento
      for (const [k, v] of Object.entries(l.porMes)) t.porMes[k] = (t.porMes[k] ?? 0) + v
    }
    return t
  }, [linhas])

  function exportarResumo() {
    const linhasExp: (Linha | 'TOTAL')[] = [...linhas, 'TOTAL']
    const dado = (r: Linha | 'TOTAL') => (r === 'TOTAL' ? totais : r)
    exportToExcel(
      linhasExp,
      [
        { label: 'Supervisor', value: r => (r === 'TOTAL' ? 'TOTAL' : r.supervisor) },
        ...(incluirVencidos ? [{ label: 'Vencidos', value: (r: Linha | 'TOTAL') => dado(r).vencidos }] : []),
        ...meses.map(m => ({ label: mesLabel(m), value: (r: Linha | 'TOTAL') => dado(r).porMes[m] ?? 0 })),
        { label: 'Total períodos', value: r => dado(r).total },
        { label: 'Sem agendamento', value: r => dado(r).semAgendamento },
        { label: 'Dias de direito', value: r => dado(r).dias },
      ],
      `panorama-ferias-resumo-${hojeIso}.xlsx`
    )
  }

  function exportarDetalhe() {
    const itens = linhas.flatMap(l => l.itens)
    exportToExcel(
      itens,
      [
        { label: 'Supervisor', value: r => r.supervisor_nome },
        { label: 'Registro', value: r => r.funcionario_registro, asText: true },
        { label: 'Funcionário', value: r => r.funcionario_nome },
        { label: 'Posto', value: r => r.posto_nome },
        { label: 'Secretaria', value: r => r.secretaria },
        { label: 'Período', value: r => `${r.numero_periodo ?? ''}º` },
        { label: 'Limite Gozo', value: r => fmt(r.limite_gozo), asText: true },
        { label: 'Prazo', value: r => prazoLabel(r.status, r.limite_gozo) },
        { label: 'Dias', value: r => r.dias_direito ?? 0 },
        { label: 'Status', value: r => STATUS_LABEL[r.status] ?? r.status },
        { label: 'Início', value: r => fmt(r.data_inicio), asText: true },
        { label: 'Fim', value: r => fmt(r.data_fim), asText: true },
      ],
      `panorama-ferias-detalhe-${hojeIso}.xlsx`
    )
  }

  const inputCls = 'border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300'
  const thCls = 'px-3 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap'

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-500">Carregando...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/ferias" className="text-xs text-slate-400 hover:text-slate-700">← Férias</Link>
          <h1 className="text-2xl font-bold text-slate-900">Panorama de férias a vencer</h1>
          <p className="text-sm text-slate-500">
            Períodos ainda não gozados, por supervisor, agrupados pelo mês do limite de gozo. Desligados ficam de fora.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportarResumo}
            disabled={linhas.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-white border border-green-500 text-green-700 rounded-lg hover:bg-green-50 transition disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel resumo
          </button>
          <button
            type="button"
            onClick={exportarDetalhe}
            disabled={linhas.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-white border border-green-500 text-green-700 rounded-lg hover:bg-green-50 transition disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel detalhado
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="text-xs uppercase tracking-widest text-slate-500 flex flex-col gap-1">
          Limite de gozo de
          <input type="date" value={de} onChange={e => setDe(e.target.value)} className={inputCls} />
        </label>
        <label className="text-xs uppercase tracking-widest text-slate-500 flex flex-col gap-1">
          até
          <input type="date" value={ate} onChange={e => setAte(e.target.value)} className={inputCls} />
        </label>
        <label className="text-xs uppercase tracking-widest text-slate-500 flex flex-col gap-1">
          Secretaria
          <select value={secretaria} onChange={e => setSecretaria(e.target.value)} className={inputCls}>
            <option value="todas">Todas</option>
            {secretarias.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 pb-2">
          <input type="checkbox" checked={incluirVencidos} onChange={e => setIncluirVencidos(e.target.checked)} />
          Incluir já vencidos
        </label>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: 'Períodos a conceder', v: totais.total, c: 'border-blue-500' },
          { l: 'Sem agendamento', v: totais.semAgendamento, c: 'border-amber-400' },
          { l: 'Já vencidos', v: totais.vencidos, c: 'border-red-500' },
          { l: 'Dias de direito', v: totais.dias, c: 'border-orange-400' },
        ].map(k => (
          <div key={k.l} className={`bg-white rounded-xl border border-slate-200 border-t-4 ${k.c} shadow-sm p-4`}>
            <div className="text-3xl font-bold text-slate-900">{k.v}</div>
            <div className="text-xs uppercase tracking-widest text-slate-500">{k.l}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className={`${thCls} text-left`}>Supervisor</th>
                {incluirVencidos && <th className={`${thCls} text-center text-red-600`}>Vencidos</th>}
                {meses.map(m => <th key={m} className={`${thCls} text-center`}>{mesLabel(m)}</th>)}
                <th className={`${thCls} text-center`}>Total</th>
                <th className={`${thCls} text-center`}>Sem agend.</th>
                <th className={`${thCls} text-center`}>Dias</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhas.length === 0 && (
                <tr><td colSpan={meses.length + 5} className="px-4 py-10 text-center text-slate-400">Nenhum período a vencer neste intervalo</td></tr>
              )}
              {linhas.map(l => (
                <Fragment key={l.supervisor}>
                  <tr
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setAberto(aberto === l.supervisor ? null : l.supervisor)}
                  >
                    <td className="px-3 py-3 font-medium text-slate-800">
                      <span className="text-slate-400 mr-1">{aberto === l.supervisor ? '▾' : '▸'}</span>
                      {l.supervisor}
                    </td>
                    {incluirVencidos && (
                      <td className="px-3 py-3 text-center font-semibold text-red-600">{l.vencidos || '—'}</td>
                    )}
                    {meses.map(m => <td key={m} className="px-3 py-3 text-center text-slate-700">{l.porMes[m] || '—'}</td>)}
                    <td className="px-3 py-3 text-center font-bold text-slate-900">{l.total}</td>
                    <td className="px-3 py-3 text-center text-amber-700">{l.semAgendamento || '—'}</td>
                    <td className="px-3 py-3 text-center text-slate-600">{l.dias}</td>
                  </tr>
                  {aberto === l.supervisor && (
                    <tr>
                      <td colSpan={meses.length + 5} className="bg-slate-50 px-6 py-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left uppercase tracking-widest text-slate-500">
                              <th className="py-1 pr-3">Funcionário</th>
                              <th className="py-1 pr-3">Posto</th>
                              <th className="py-1 pr-3">Período</th>
                              <th className="py-1 pr-3">Limite</th>
                              <th className="py-1 pr-3">Prazo</th>
                              <th className="py-1 pr-3">Dias</th>
                              <th className="py-1">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {l.itens.map(i => {
                              const d = diasAteLimite(i.limite_gozo)
                              return (
                                <tr key={i.id} className="border-t border-slate-200 text-slate-700">
                                  <td className="py-1 pr-3">{i.funcionario_nome} <span className="text-slate-400">{i.funcionario_registro}</span></td>
                                  <td className="py-1 pr-3">{i.posto_nome}</td>
                                  <td className="py-1 pr-3">{i.numero_periodo ?? '—'}º</td>
                                  <td className="py-1 pr-3">{fmt(i.limite_gozo)}</td>
                                  <td className={`py-1 pr-3 ${d !== null && d < 0 ? 'text-red-600 font-semibold' : ''}`}>{prazoLabel(i.status, i.limite_gozo)}</td>
                                  <td className="py-1 pr-3">{i.dias_direito ?? '—'}</td>
                                  <td className="py-1">{STATUS_LABEL[i.status] ?? i.status}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {linhas.length > 0 && (
                <tr className="bg-slate-100 font-bold text-slate-900">
                  <td className="px-3 py-3">TOTAL</td>
                  {incluirVencidos && <td className="px-3 py-3 text-center text-red-600">{totais.vencidos}</td>}
                  {meses.map(m => <td key={m} className="px-3 py-3 text-center">{totais.porMes[m] ?? 0}</td>)}
                  <td className="px-3 py-3 text-center">{totais.total}</td>
                  <td className="px-3 py-3 text-center">{totais.semAgendamento}</td>
                  <td className="px-3 py-3 text-center">{totais.dias}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
