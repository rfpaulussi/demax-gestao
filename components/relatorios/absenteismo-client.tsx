'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AusenciaRow, FeriasRow } from '@/app/(admin)/relatorios/absenteismo/actions'

const sel = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

function fmt(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function pad2(n: number) { return String(n).padStart(2, '0') }

const TIPO_LABELS: Record<string, string> = { falta: 'Falta', atestado: 'Atestado', suspensao: 'Suspensão' }
const TIPO_COLORS: Record<string, string> = {
  falta:     'bg-red-100 text-red-700',
  atestado:  'bg-amber-100 text-amber-700',
  suspensao: 'bg-purple-100 text-purple-700',
}

function exportExcel(absRows: AusenciaRow[], feriasRows: FeriasRow[], mes: number, ano: number, MESES: string[]) {
  const wb = XLSX.utils.book_new()

  // --- Aba 1: Absenteísmo ---
  const TIPOS = ['falta', 'atestado', 'suspensao'] as const
  const H_ABS = ['Funcionário', 'Matrícula', 'Posto', 'Secretaria', 'Tipo', 'Data', 'Dias', 'Justificativa']
  const NC_ABS = H_ABS.length

  type XRow = { data: (string | number)[]; style?: 'groupHeader' | 'colHeader' | 'totals' }
  const absXRows: XRow[] = [
    { data: [`Absenteísmo — ${MESES[mes]} ${ano}`] },
    { data: [] },
  ]
  for (const tipo of TIPOS) {
    const grupo = absRows.filter(r => r.tipo_ausencia === tipo)
    if (grupo.length === 0) continue
    const totalDias = grupo.reduce((a, r) => a + r.dias, 0)
    absXRows.push({ data: [`${TIPO_LABELS[tipo].toUpperCase()} (${grupo.length} · ${totalDias} dias)`, ...Array(NC_ABS - 1).fill('')], style: 'groupHeader' })
    absXRows.push({ data: H_ABS, style: 'colHeader' })
    for (const r of grupo) {
      absXRows.push({ data: [r.funcionario_nome, r.registro ?? '—', r.posto_nome, r.secretaria, TIPO_LABELS[r.tipo_ausencia], fmt(r.data), r.dias, r.justificativa] })
    }
    absXRows.push({ data: ['TOTAL', '', '', '', '', '', totalDias, ''], style: 'totals' })
    absXRows.push({ data: [] })
  }

  const ws1 = XLSX.utils.aoa_to_sheet(absXRows.map(r => r.data))
  absXRows.forEach((row, ri) => {
    if (!row.style) return
    for (let ci = 0; ci < NC_ABS; ci++) {
      const addr = XLSX.utils.encode_cell({ r: ri, c: ci })
      if (!ws1[addr]) ws1[addr] = { v: '', t: 's' }
      if (row.style === 'groupHeader') ws1[addr].s = { fill: { patternType: 'solid', fgColor: { rgb: '1e293b' } }, font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 10 } }
      else if (row.style === 'totals')  ws1[addr].s = { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'f1f5f9' } } }
      else if (row.style === 'colHeader') ws1[addr].s = { font: { bold: true, color: { rgb: '475569' } }, fill: { patternType: 'solid', fgColor: { rgb: 'e2e8f0' } } }
    }
  })
  ws1['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 7 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Absenteísmo')

  // --- Aba 2: Férias ---
  const H_FER = ['Funcionário', 'Matrícula', 'Posto', 'Secretaria', 'Data Início', 'Data Fim', 'Dias no Mês']
  const NC_FER = H_FER.length
  const ferXRows: XRow[] = [
    { data: [`Ausências Programadas — Férias — ${MESES[mes]} ${ano}`] },
    { data: [] },
    { data: H_FER, style: 'colHeader' },
  ]
  for (const r of feriasRows) {
    ferXRows.push({ data: [r.funcionario_nome, r.registro ?? '—', r.posto_nome, r.secretaria, fmt(r.data_inicio), fmt(r.data_fim), r.dias_no_mes] })
  }
  const totalDiasFer = feriasRows.reduce((s, r) => s + r.dias_no_mes, 0)
  ferXRows.push({ data: ['TOTAL', '', '', '', '', '', totalDiasFer], style: 'totals' })

  const ws2 = XLSX.utils.aoa_to_sheet(ferXRows.map(r => r.data))
  ferXRows.forEach((row, ri) => {
    if (!row.style) return
    for (let ci = 0; ci < NC_FER; ci++) {
      const addr = XLSX.utils.encode_cell({ r: ri, c: ci })
      if (!ws2[addr]) ws2[addr] = { v: '', t: 's' }
      if (row.style === 'totals')    ws2[addr].s = { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'f1f5f9' } } }
      else if (row.style === 'colHeader') ws2[addr].s = { font: { bold: true, color: { rgb: '475569' } }, fill: { patternType: 'solid', fgColor: { rgb: 'e2e8f0' } } }
    }
  })
  ws2['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Férias')

  XLSX.writeFile(wb, `absenteismo-${pad2(mes)}-${ano}.xlsx`)
}

async function exportPDF(absRows: AusenciaRow[], feriasRows: FeriasRow[], taxa: number, mes: number, ano: number, MESES: string[]) {
  const { pdf } = await import('@react-pdf/renderer')
  const { AbsenteismoDoc } = await import('./absenteismo-pdf')
  const blob = await pdf(<AbsenteismoDoc absRows={absRows} feriasRows={feriasRows} taxa={taxa} mes={mes} ano={ano} MESES={MESES} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `absenteismo-${pad2(mes)}-${ano}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

interface Props {
  absRows: AusenciaRow[]
  feriasRows: FeriasRow[]
  taxa: number
  mes: number
  ano: number
  MESES: string[]
  anos: number[]
}

export function AbsenteismoClient({ absRows, feriasRows, taxa, mes, ano, MESES, anos }: Props) {
  const [loadingXlsx, setLoadingXlsx] = useState(false)
  const [loadingPdf,  setLoadingPdf]  = useState(false)

  const TIPOS = ['falta', 'atestado', 'suspensao'] as const
  const hasData = absRows.length > 0 || feriasRows.length > 0

  return (
    <>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Mês</label>
          <select name="mes" defaultValue={mes} className={sel}>
            {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Ano</label>
          <select name="ano" defaultValue={ano} className={sel}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <button type="submit" className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700">
          Filtrar
        </button>
        <a href="/relatorios/absenteismo" className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50">
          Limpar
        </a>
        <div className="ml-auto flex items-end gap-2">
          <button
            type="button"
            onClick={() => { setLoadingXlsx(true); try { exportExcel(absRows, feriasRows, mes, ano, MESES) } finally { setLoadingXlsx(false) } }}
            disabled={loadingXlsx || !hasData}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            {loadingXlsx ? 'Gerando…' : 'Excel'}
          </button>
          <button
            type="button"
            onClick={async () => { setLoadingPdf(true); try { await exportPDF(absRows, feriasRows, taxa, mes, ano, MESES) } finally { setLoadingPdf(false) } }}
            disabled={loadingPdf || !hasData}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-40"
          >
            <FileText className="h-4 w-4" />
            {loadingPdf ? 'Gerando…' : 'PDF'}
          </button>
        </div>
      </form>

      {/* Tabela 1: Absenteísmo */}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Absenteísmo — {absRows.length} ocorrência{absRows.length !== 1 ? 's' : ''}
        </p>
      </div>

      {absRows.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-10 text-center shadow-sm">
          <p className="text-sm text-gray-400">Nenhuma ausência não programada no período.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {TIPOS.map(tipo => {
            const grupo = absRows.filter(r => r.tipo_ausencia === tipo)
            if (grupo.length === 0) return null
            const totalDias = grupo.reduce((a, r) => a + r.dias, 0)
            return (
              <div key={tipo} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="bg-slate-800 px-4 py-2.5">
                  <span className="text-xs font-bold uppercase tracking-widest text-white">
                    {TIPO_LABELS[tipo]} — {grupo.length} registro{grupo.length !== 1 ? 's' : ''} · {totalDias} dias
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ minWidth: '800px' }}>
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {['Funcionário','Matrícula','Posto','Secretaria','Tipo','Data','Dias','Justificativa'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {grupo.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50/80">
                          <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{r.funcionario_nome}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-gray-400 whitespace-nowrap">{r.registro ?? '—'}</td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.posto_nome}</td>
                          <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.secretaria}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', TIPO_COLORS[r.tipo_ausencia])}>
                              {TIPO_LABELS[r.tipo_ausencia]}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmt(r.data)}</td>
                          <td className="px-3 py-2.5 text-center font-mono font-semibold text-amber-600">{r.dias}</td>
                          <td className="px-3 py-2.5 text-gray-400 max-w-xs truncate">{r.justificativa}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Total</td>
                        <td className={cn('px-3 py-2 text-center font-mono font-bold', TIPO_COLORS[tipo])}>{totalDias}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tabela 2: Férias */}
      <div className="space-y-1 pt-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Ausências Programadas — Férias — {feriasRows.length} funcionário{feriasRows.length !== 1 ? 's' : ''}
        </p>
      </div>

      {feriasRows.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-10 text-center shadow-sm">
          <p className="text-sm text-gray-400">Nenhum funcionário em férias no período.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="bg-blue-800 px-4 py-2.5">
            <span className="text-xs font-bold uppercase tracking-widest text-white">
              Férias — {feriasRows.length} funcionário{feriasRows.length !== 1 ? 's' : ''} · {feriasRows.reduce((s, r) => s + r.dias_no_mes, 0)} dias no mês
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '750px' }}>
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Funcionário','Matrícula','Posto','Secretaria','Data Início','Data Fim','Dias no Mês'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {feriasRows.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50/80">
                    <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{r.funcionario_nome}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-400 whitespace-nowrap">{r.registro ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.posto_nome}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.secretaria}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmt(r.data_inicio)}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmt(r.data_fim)}</td>
                    <td className="px-3 py-2.5 text-center font-mono font-semibold text-blue-600">{r.dias_no_mes}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50">
                  <td colSpan={6} className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Total</td>
                  <td className="px-3 py-2 text-center font-mono font-bold text-blue-600">
                    {feriasRows.reduce((s, r) => s + r.dias_no_mes, 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
