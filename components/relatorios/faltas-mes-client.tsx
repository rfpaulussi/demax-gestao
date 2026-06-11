'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FaltaMesRow } from '@/app/(admin)/relatorios/faltas-mes/actions'

const sel = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

function fmt(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function maskCpf(cpf: string | null): string {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `***.***.${ d.slice(6, 9) }-${ d.slice(9) }`
}

function pad2(n: number) { return String(n).padStart(2, '0') }

const TIPO_LABELS: Record<string, string> = {
  sem_justificativa: 'Sem Justificativa',
  declaracao: 'Declaração',
  sem_atestado: 'Sem Atestado',
  com_atestado: 'Com Atestado',
  suspensao: 'Suspensão',
}

function exportExcel(rows: FaltaMesRow[], mes: number, ano: number, MESES: string[]) {
  const wb = XLSX.utils.book_new()
  const HEADERS = ['Data', 'Funcionário', 'Matrícula', 'Posto', 'Secretaria', 'Supervisor', 'Tipo', 'Dias', 'Tem Documento', 'Justificativa']
  const NC = HEADERS.length

  type XRow = { data: (string | number)[]; style?: 'colHeader' }
  const allRows: XRow[] = [
    { data: [`Faltas do Mês — ${MESES[mes]} ${ano}`] },
    { data: [] },
    { data: HEADERS, style: 'colHeader' },
  ]

  for (const r of rows) {
    allRows.push({ data: [
      fmt(r.data_falta), r.funcionario_nome, maskCpf(r.cpf), r.posto_nome, r.secretaria,
      r.supervisor, TIPO_LABELS[r.tipo] ?? r.tipo, r.dias, r.tem_documento ? 'Sim' : 'Não', r.justificativa,
    ]})
  }

  const ws = XLSX.utils.aoa_to_sheet(allRows.map(r => r.data))
  allRows.forEach((row, ri) => {
    if (row.style !== 'colHeader') return
    for (let ci = 0; ci < NC; ci++) {
      const addr = XLSX.utils.encode_cell({ r: ri, c: ci })
      if (!ws[addr]) ws[addr] = { v: '', t: 's' }
      ws[addr].s = { font: { bold: true, color: { rgb: '475569' } }, fill: { patternType: 'solid', fgColor: { rgb: 'e2e8f0' } } }
    }
  })
  ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 7 }, { wch: 14 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Faltas')
  XLSX.writeFile(wb, `faltas-${pad2(mes)}-${ano}.xlsx`)
}

async function exportPDF(rows: FaltaMesRow[], mes: number, ano: number, MESES: string[]) {
  const { pdf } = await import('@react-pdf/renderer')
  const { FaltasMesDoc } = await import('./faltas-mes-pdf')
  const blob = await pdf(<FaltasMesDoc rows={rows} mes={mes} ano={ano} MESES={MESES} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `faltas-${pad2(mes)}-${ano}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

interface Props { rows: FaltaMesRow[]; mes: number; ano: number; MESES: string[]; anos: number[] }

export function FaltasMesClient({ rows, mes, ano, MESES, anos }: Props) {
  const [loadingXlsx, setLoadingXlsx] = useState(false)
  const [loadingPdf,  setLoadingPdf]  = useState(false)

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
        <a href="/relatorios/faltas-mes" className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50">
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
          <p className="text-sm text-gray-400">Nenhuma falta registrada no período.</p>
        </div>
      ) : (
        <div className="w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm" style={{ minWidth: '1000px' }}>
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Data','Funcionário','Matrícula','Posto','Secretaria','Supervisor','Tipo','Dias','Documento','Justificativa'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50/80">
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmt(r.data_falta)}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{r.funcionario_nome}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-400 whitespace-nowrap">{maskCpf(r.cpf)}</td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.posto_nome}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.secretaria}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.supervisor}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="inline-block rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                        {TIPO_LABELS[r.tipo] ?? r.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-semibold text-orange-600">{r.dias}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                        r.tem_documento ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                        {r.tem_documento ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 max-w-xs truncate">{r.justificativa}</td>
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
