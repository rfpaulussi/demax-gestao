'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import { FileSpreadsheet, FileText } from 'lucide-react'
import type { MudancaFuncaoRow } from '@/app/(admin)/relatorios/mudancas-funcao/actions'

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

function exportExcel(dados: MudancaFuncaoRow[], mes: number, ano: number, MESES: string[]) {
  const wb = XLSX.utils.book_new()
  const HEADERS = ['Data', 'Funcionário', 'Matrícula', 'Supervisor', 'Função Anterior', 'Função Nova', 'Posto', 'Secretaria']
  const NC = HEADERS.length

  type XRow = { data: (string | number)[]; style?: 'colHeader' }
  const rows: XRow[] = [
    { data: [`Mudanças de Função — ${MESES[mes]} ${ano}`] },
    { data: [] },
    { data: HEADERS, style: 'colHeader' },
  ]

  for (const r of dados) {
    rows.push({ data: [fmt(r.data_evento), r.funcionario_nome, maskCpf(r.cpf), r.supervisor, r.funcao_anterior, r.funcao_nova, r.posto_nome, r.secretaria] })
  }

  const ws = XLSX.utils.aoa_to_sheet(rows.map(r => r.data))
  rows.forEach((row, ri) => {
    if (row.style !== 'colHeader') return
    for (let ci = 0; ci < NC; ci++) {
      const addr = XLSX.utils.encode_cell({ r: ri, c: ci })
      if (!ws[addr]) ws[addr] = { v: '', t: 's' }
      ws[addr].s = { font: { bold: true, color: { rgb: '475569' } }, fill: { patternType: 'solid', fgColor: { rgb: 'e2e8f0' } } }
    }
  })
  ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 22 }, { wch: 24 }, { wch: 24 }, { wch: 22 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Mudanças de Função')
  XLSX.writeFile(wb, `mudancas-funcao-${pad2(mes)}-${ano}.xlsx`)
}

async function exportPDF(dados: MudancaFuncaoRow[], mes: number, ano: number, MESES: string[]) {
  const { pdf } = await import('@react-pdf/renderer')
  const { MudancasFuncaoDoc } = await import('./mudancas-funcao-pdf')
  const blob = await pdf(<MudancasFuncaoDoc dados={dados} mes={mes} ano={ano} MESES={MESES} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mudancas-funcao-${pad2(mes)}-${ano}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

interface Props {
  dados: MudancaFuncaoRow[]
  mes: number
  ano: number
  MESES: string[]
  anos: number[]
}

export function MudancasFuncaoClient({ dados, mes, ano, MESES, anos }: Props) {
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
        <a href="/relatorios/mudancas-funcao" className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50">
          Limpar
        </a>
        <div className="ml-auto flex items-end gap-2">
          <button
            type="button"
            onClick={() => { setLoadingXlsx(true); try { exportExcel(dados, mes, ano, MESES) } finally { setLoadingXlsx(false) } }}
            disabled={loadingXlsx || dados.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            {loadingXlsx ? 'Gerando…' : 'Excel'}
          </button>
          <button
            type="button"
            onClick={async () => { setLoadingPdf(true); try { await exportPDF(dados, mes, ano, MESES) } finally { setLoadingPdf(false) } }}
            disabled={loadingPdf || dados.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-40"
          >
            <FileText className="h-4 w-4" />
            {loadingPdf ? 'Gerando…' : 'PDF'}
          </button>
        </div>
      </form>

      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        {dados.length} registro{dados.length !== 1 ? 's' : ''}
      </p>

      {dados.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm">
          <p className="text-sm text-gray-400">Nenhuma mudança de função encontrada para o período.</p>
        </div>
      ) : (
        <div className="w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm" style={{ minWidth: '900px' }}>
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Data','Funcionário','Matrícula','Supervisor','Função Anterior','Função Nova','Posto','Secretaria'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dados.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50/80">
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmt(r.data_evento)}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{r.funcionario_nome}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-400 whitespace-nowrap">{maskCpf(r.cpf)}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.supervisor}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.funcao_anterior}</td>
                    <td className="px-3 py-2.5 text-indigo-600 font-medium whitespace-nowrap">{r.funcao_nova}</td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.posto_nome}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.secretaria}</td>
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
