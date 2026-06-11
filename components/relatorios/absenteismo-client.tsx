'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AusenciaRow } from '@/app/(admin)/relatorios/absenteismo/actions'

const sel = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

function fmt(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function pad2(n: number) { return String(n).padStart(2, '0') }

const TIPO_LABELS: Record<string, string> = { falta: 'Falta', atestado: 'Atestado', ferias: 'Férias' }
const TIPO_COLORS: Record<string, string> = {
  falta:    'bg-red-100 text-red-700',
  atestado: 'bg-amber-100 text-amber-700',
  ferias:   'bg-orange-100 text-orange-700',
}

function exportExcel(rows: AusenciaRow[], mes: number, ano: number, MESES: string[]) {
  const wb = XLSX.utils.book_new()
  const tipos = ['falta', 'atestado', 'ferias'] as const
  const HEADERS = ['Funcionário', 'Matrícula', 'Posto', 'Secretaria', 'Tipo Ausência', 'Data', 'Dias', 'Justificativa']
  const NC = HEADERS.length

  type XRow = { data: (string | number)[]; style?: 'groupHeader' | 'colHeader' | 'totals' }
  const allRows: XRow[] = [
    { data: [`Absenteísmo — ${MESES[mes]} ${ano}`] },
    { data: [] },
  ]

  for (const tipo of tipos) {
    const grupo = rows.filter(r => r.tipo_ausencia === tipo)
    if (grupo.length === 0) continue
    const totalDias = grupo.reduce((a, r) => a + r.dias, 0)
    allRows.push({ data: [`${TIPO_LABELS[tipo].toUpperCase()} (${grupo.length} · ${totalDias} dias)`, ...Array(NC - 1).fill('')], style: 'groupHeader' })
    allRows.push({ data: HEADERS, style: 'colHeader' })
    for (const r of grupo) {
      allRows.push({ data: [r.funcionario_nome, r.registro ?? '—', r.posto_nome, r.secretaria, TIPO_LABELS[r.tipo_ausencia], fmt(r.data), r.dias, r.justificativa] })
    }
    allRows.push({ data: ['TOTAL', '', '', '', '', '', totalDias, ''], style: 'totals' })
    allRows.push({ data: [] })
  }

  const ws = XLSX.utils.aoa_to_sheet(allRows.map(r => r.data))
  allRows.forEach((row, ri) => {
    if (!row.style) return
    for (let ci = 0; ci < NC; ci++) {
      const addr = XLSX.utils.encode_cell({ r: ri, c: ci })
      if (!ws[addr]) ws[addr] = { v: '', t: 's' }
      if (row.style === 'groupHeader') {
        ws[addr].s = { fill: { patternType: 'solid', fgColor: { rgb: '1e293b' } }, font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 10 } }
      } else if (row.style === 'totals') {
        ws[addr].s = { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'f1f5f9' } } }
      } else if (row.style === 'colHeader') {
        ws[addr].s = { font: { bold: true, color: { rgb: '475569' } }, fill: { patternType: 'solid', fgColor: { rgb: 'e2e8f0' } } }
      }
    }
  })
  ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 7 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Absenteísmo')
  XLSX.writeFile(wb, `absenteismo-${pad2(mes)}-${ano}.xlsx`)
}

async function exportPDF(rows: AusenciaRow[], mes: number, ano: number, MESES: string[]) {
  const { pdf } = await import('@react-pdf/renderer')
  const { AbsenteismoDoc } = await import('./absenteismo-pdf')
  const blob = await pdf(<AbsenteismoDoc rows={rows} mes={mes} ano={ano} MESES={MESES} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `absenteismo-${pad2(mes)}-${ano}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

interface Props { rows: AusenciaRow[]; mes: number; ano: number; MESES: string[]; anos: number[] }

export function AbsenteismoClient({ rows, mes, ano, MESES, anos }: Props) {
  const [loadingXlsx, setLoadingXlsx] = useState(false)
  const [loadingPdf,  setLoadingPdf]  = useState(false)

  const tipos = ['falta', 'atestado', 'ferias'] as const

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
            onClick={() => { setLoadingXlsx(true); try { exportExcel(rows, mes, ano, MESES) } finally { setLoadingXlsx(false) } }}
            disabled={loadingXlsx || rows.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            {loadingXlsx ? 'Gerando…' : 'Excel'}
          </button>
          <button
            type="button"
            onClick={async () => { setLoadingPdf(true); try { await exportPDF(rows, mes, ano, MESES) } finally { setLoadingPdf(false) } }}
            disabled={loadingPdf || rows.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-40"
          >
            <FileText className="h-4 w-4" />
            {loadingPdf ? 'Gerando…' : 'PDF'}
          </button>
        </div>
      </form>

      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        {rows.length} registro{rows.length !== 1 ? 's' : ''}
      </p>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm">
          <p className="text-sm text-gray-400">Nenhuma ausência registrada no período.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tipos.map(tipo => {
            const grupo = rows.filter(r => r.tipo_ausencia === tipo)
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
                        {['Funcionário','Matrícula','Posto','Secretaria','Data','Dias','Justificativa'].map(h => (
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
                          <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmt(r.data)}</td>
                          <td className="px-3 py-2.5 text-center font-mono font-semibold text-amber-600">{r.dias}</td>
                          <td className="px-3 py-2.5 text-gray-400 max-w-xs truncate">{r.justificativa}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50">
                        <td colSpan={5} className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Total</td>
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
    </>
  )
}
