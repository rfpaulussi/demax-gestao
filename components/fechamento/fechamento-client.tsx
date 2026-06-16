'use client'

import { useState } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx-js-style'
import { FileSpreadsheet, FileText, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FechamentoFuncionario } from '@/app/(admin)/fechamento/actions'

const sel = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function pad2(n: number) { return String(n).padStart(2, '0') }

// ─── Excel export ─────────────────────────────────────────────────────────────

type XlsxRow = { data: (string | number)[]; rowStyle?: 'groupHeader' | 'totals' | 'colHeader' }

function exportExcel(dados: FechamentoFuncionario[], mes: number, ano: number, MESES: string[]) {
  const wb = XLSX.utils.book_new()
  const secretarias = Array.from(new Set(dados.map(f => f.secretaria ?? 'Sem Secretaria'))).sort()
  const HEADERS = ['Nome','Função','Posto','Secretaria','Regime','D.Úteis','Férias','Faltas','Atestados','Suspensão','Afastamento','Trabalhados','Insalubridade','Advertência']
  const NC = HEADERS.length

  const rows: XlsxRow[] = [
    { data: [`Fechamento — ${MESES[mes]} ${ano}`] },
    { data: [] },
  ]

  for (const sec of secretarias) {
    const grupo = dados.filter(d => (d.secretaria ?? 'Sem Secretaria') === sec)
    rows.push({ data: [sec.toUpperCase(), ...Array(NC - 1).fill('')], rowStyle: 'groupHeader' })
    rows.push({ data: HEADERS, rowStyle: 'colHeader' })

    for (const f of grupo) {
      rows.push({ data: [
        f.funcionario_nome, f.funcao ?? '—', f.posto_nome ?? '—', f.secretaria ?? '—', f.regime,
        f.dias_uteis, f.ferias_dias || 0, f.faltas_dias || 0, f.atestados_dias || 0,
        f.dias_suspensao || 0, f.afastamento_dias || 0, f.dias_trabalhados, f.insalubridade_dias || 0,
        f.tem_suspensao ? 'Suspensão' : f.tem_advertencia ? 'Sim' : '',
      ]})
    }

    rows.push({ data: [
      'TOTAL', '', '', '', '',
      grupo.reduce((s, f) => s + f.dias_uteis, 0),
      grupo.reduce((s, f) => s + (f.ferias_dias || 0), 0),
      grupo.reduce((s, f) => s + (f.faltas_dias || 0), 0),
      grupo.reduce((s, f) => s + (f.atestados_dias || 0), 0),
      grupo.reduce((s, f) => s + (f.dias_suspensao || 0), 0),
      grupo.reduce((s, f) => s + f.dias_trabalhados, 0),
      grupo.reduce((s, f) => s + (f.insalubridade_dias || 0), 0),
      '',
    ], rowStyle: 'totals' })

    rows.push({ data: [] })
  }

  const aoa = rows.map(r => r.data)
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  rows.forEach((row, ri) => {
    if (!row.rowStyle) return
    const isGroup  = row.rowStyle === 'groupHeader'
    const isTotals = row.rowStyle === 'totals'
    const isColHdr = row.rowStyle === 'colHeader'

    for (let ci = 0; ci < NC; ci++) {
      const addr = XLSX.utils.encode_cell({ r: ri, c: ci })
      if (!ws[addr]) ws[addr] = { v: '', t: 's' }
      if (isGroup) {
        ws[addr].s = {
          fill: { patternType: 'solid', fgColor: { rgb: '1e293b' } },
          font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 10 },
        }
      } else if (isTotals) {
        ws[addr].s = {
          font: { bold: true },
          fill: { patternType: 'solid', fgColor: { rgb: 'f1f5f9' } },
        }
      } else if (isColHdr) {
        ws[addr].s = {
          font: { bold: true, color: { rgb: '475569' } },
          fill: { patternType: 'solid', fgColor: { rgb: 'e2e8f0' } },
        }
      }
    }
  })

  ws['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 7 },
    ...Array(7).fill({ wch: 10 }), { wch: 13 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Fechamento')
  XLSX.writeFile(wb, `fechamento-${pad2(mes)}-${ano}.xlsx`)
}

// ─── PDF export ───────────────────────────────────────────────────────────────

async function exportPDF(dados: FechamentoFuncionario[], mes: number, ano: number, MESES: string[]) {
  const { pdf }               = await import('@react-pdf/renderer')
  const { FechamentoPDFDoc }  = await import('./fechamento-pdf-doc')
  const blob = await pdf(<FechamentoPDFDoc dados={dados} mes={mes} ano={ano} MESES={MESES} />).toBlob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `fechamento-${pad2(mes)}-${ano}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── component ────────────────────────────────────────────────────────────────

interface Props {
  dados: FechamentoFuncionario[]
  mes: number
  ano: number
  secretariaAtiva: string
  secretarias: string[]
  MESES: string[]
  anos: number[]
}

export function FechamentoClient({ dados, mes, ano, secretariaAtiva, secretarias, MESES, anos }: Props) {
  const [loadingXlsx, setLoadingXlsx] = useState(false)
  const [loadingPdf,  setLoadingPdf]  = useState(false)
  const [mostrarVazias, setMostrarVazias] = useState(false)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const dadosOrdenados = sortCol ? [...dados].sort((a, b) => {
    const map: Record<string, number> = {
      nome:          a.funcionario_nome.localeCompare(b.funcionario_nome),
      uteis:         a.dias_uteis - b.dias_uteis,
      ferias:        a.ferias_dias - b.ferias_dias,
      faltas:        a.faltas_dias - b.faltas_dias,
      atestados:     a.atestados_dias - b.atestados_dias,
      trabalhados:   a.dias_trabalhados - b.dias_trabalhados,
      insalubridade: a.insalubridade_dias - b.insalubridade_dias,
    }
    return sortDir === 'asc' ? map[sortCol] : -map[sortCol]
  }) : dados

  const exibirSuspensao   = mostrarVazias
  const exibirAfastamento = mostrarVazias

  async function handleExcel() {
    setLoadingXlsx(true)
    try { exportExcel(dados, mes, ano, MESES) } finally { setLoadingXlsx(false) }
  }

  async function handlePDF() {
    setLoadingPdf(true)
    try { await exportPDF(dados, mes, ano, MESES) } finally { setLoadingPdf(false) }
  }

  return (
    <>
      {/* Filters + export buttons */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Mês</label>
          <select name="mes" defaultValue={mes} className={sel}>
            {MESES.slice(1).map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Ano</label>
          <select name="ano" defaultValue={ano} className={sel}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Secretaria</label>
          <select name="secretaria" defaultValue={secretariaAtiva} className={sel}>
            <option value="">Todas</option>
            {secretarias.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button type="submit" className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700">
          Filtrar
        </button>
        <a href="/fechamento" className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50">
          Limpar
        </a>

        {/* Export buttons — fora do form para não submeter */}
        <div className="ml-auto flex items-end gap-2">
          <button
            type="button"
            onClick={handleExcel}
            disabled={loadingXlsx || dados.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            {loadingXlsx ? 'Gerando…' : 'Excel'}
          </button>
          <button
            type="button"
            onClick={handlePDF}
            disabled={loadingPdf || dados.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-40"
          >
            <FileText className="h-4 w-4" />
            {loadingPdf ? 'Gerando…' : 'PDF'}
          </button>
          <Link
            href="/fechamento/config-escalas"
            className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Settings2 className="h-4 w-4 text-slate-500" />
            Config. Escalas
          </Link>
        </div>
      </form>

      <div className="flex items-center gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {dados.length} funcionário{dados.length !== 1 ? 's' : ''}
        </p>
        <button
          type="button"
          onClick={() => setMostrarVazias(v => !v)}
          className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600"
        >
          {mostrarVazias ? 'Ocultar colunas opcionais' : 'Mostrar todas as colunas'}
        </button>
      </div>

      {dados.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm">
          <p className="text-sm text-gray-400">Nenhum funcionário encontrado para o período.</p>
        </div>
      ) : (
        <div className="w-full rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-scroll w-full">
            <table className="w-full text-sm" style={{ minWidth: '1400px' }}>
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th onClick={() => toggleSort('nome')} className="sticky left-0 z-10 bg-gray-50 min-w-[220px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400 cursor-pointer select-none hover:text-gray-600">
                    Funcionário {sortCol === 'nome' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="text-gray-300">↕</span>}
                  </th>
                  <th className="min-w-[160px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Função</th>
                  <th className="min-w-[200px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Posto</th>
                  <th className="min-w-[80px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Secretaria</th>
                  <th className="min-w-[160px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Período no mês</th>
                  <th className="min-w-[55px] px-3 py-3 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">Regime</th>
                  <th onClick={() => toggleSort('uteis')} className="min-w-[70px] px-3 py-3 text-center text-xs font-semibold uppercase tracking-widest text-gray-400 cursor-pointer select-none hover:text-gray-600">
                    D. Úteis {sortCol === 'uteis' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="text-gray-300">↕</span>}
                  </th>
                  <th onClick={() => toggleSort('ferias')} className="min-w-[70px] px-3 py-3 text-center text-xs font-semibold uppercase tracking-widest text-gray-400 cursor-pointer select-none hover:text-gray-600">
                    Férias {sortCol === 'ferias' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="text-gray-300">↕</span>}
                  </th>
                  <th onClick={() => toggleSort('faltas')} className="min-w-[70px] px-3 py-3 text-center text-xs font-semibold uppercase tracking-widest text-gray-400 cursor-pointer select-none hover:text-gray-600">
                    Faltas {sortCol === 'faltas' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="text-gray-300">↕</span>}
                  </th>
                  <th onClick={() => toggleSort('atestados')} className="min-w-[70px] px-3 py-3 text-center text-xs font-semibold uppercase tracking-widest text-gray-400 cursor-pointer select-none hover:text-gray-600">
                    Atestados {sortCol === 'atestados' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="text-gray-300">↕</span>}
                  </th>
                  {exibirSuspensao   && <th className="min-w-[70px] px-3 py-3 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">Suspensão</th>}
                  {exibirAfastamento && <th className="min-w-[70px] px-3 py-3 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">Afastamento</th>}
                  <th onClick={() => toggleSort('trabalhados')} className="min-w-[70px] px-3 py-3 text-center text-xs font-semibold uppercase tracking-widest text-gray-400 cursor-pointer select-none hover:text-gray-600">
                    Trabalhados {sortCol === 'trabalhados' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="text-gray-300">↕</span>}
                  </th>
                  <th onClick={() => toggleSort('insalubridade')} className="min-w-[90px] px-3 py-3 text-center text-xs font-semibold uppercase tracking-widest text-gray-400 cursor-pointer select-none hover:text-gray-600">
                    Insalubridade {sortCol === 'insalubridade' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="text-gray-300">↕</span>}
                  </th>
                  <th className="min-w-[90px] px-3 py-3 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">Advertência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dadosOrdenados.map(f => (
                  <tr
                    key={f.funcionario_id}
                    className={cn(
                      'transition-colors hover:bg-gray-50/80',
                      f.tem_suspensao          ? 'bg-red-50/40 hover:bg-red-50/60'
                      : f.faltas_dias > 0      ? 'bg-red-50/20 hover:bg-red-50/40'
                      : f.ferias_dias > 0      ? 'bg-orange-50/30 hover:bg-orange-50/50'
                      : f.afastamento_dias > 0 ? 'bg-gray-50/60 hover:bg-gray-50/80'
                      : null,
                    )}
                  >
                    <td className={cn(
                      'sticky left-0 z-10 px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap',
                      f.data_desligamento && 'text-gray-400',
                      f.tem_suspensao          ? 'bg-red-50/40'
                      : f.faltas_dias > 0      ? 'bg-red-50/20'
                      : f.ferias_dias > 0      ? 'bg-orange-50/30'
                      : f.afastamento_dias > 0 ? 'bg-gray-50/60'
                      : 'bg-white',
                    )}>
                      {f.funcionario_nome}
                      {f.data_desligamento && (
                        <span className="ml-1.5 inline-block rounded bg-gray-100 px-1 py-0.5 text-[10px] font-medium text-gray-500">
                          desligado {fmt(f.data_desligamento)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{f.funcao ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{f.posto_nome ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{f.secretaria ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">
                      {fmt(f.periodo_inicio)} – {fmt(f.periodo_fim)}
                      <span className="ml-1 text-gray-400">({f.dias_calendario}d)</span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs font-mono text-gray-500">{f.regime}</td>
                    <td className="px-3 py-2.5 text-center font-mono text-gray-700">{f.dias_uteis}</td>
                    <td className="px-3 py-2.5 text-center">
                      {f.ferias_dias > 0
                        ? <span className="font-mono text-orange-600">{f.ferias_dias}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {f.faltas_dias > 0
                        ? <span className="font-mono text-red-600">{f.faltas_dias}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {f.atestados_dias > 0
                        ? <span className="font-mono text-amber-600">{f.atestados_dias}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    {exibirSuspensao && (
                      <td className="px-3 py-2.5 text-center">
                        {f.dias_suspensao > 0
                          ? <span className="font-mono text-red-700 font-semibold">{f.dias_suspensao}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                    )}
                    {exibirAfastamento && (
                      <td className="px-3 py-2.5 text-center">
                        {f.afastamento_dias > 0
                          ? <span className="font-mono text-gray-600">{f.afastamento_dias}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center rounded-full bg-blue-50 px-2.5 py-0.5 font-mono text-sm font-bold text-blue-700">
                        {f.dias_trabalhados}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {f.insalubridade_dias > 0
                        ? <span className="font-mono text-purple-600">{f.insalubridade_dias}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {f.tem_suspensao
                        ? <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Suspensão</span>
                        : f.tem_advertencia
                          ? <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Sim</span>
                          : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
