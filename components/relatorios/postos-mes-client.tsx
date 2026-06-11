'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EfetivoMesRow } from '@/app/(admin)/relatorios/postos-mes/actions'

const sel = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

function pad2(n: number) { return String(n).padStart(2, '0') }

const STATUS_LABELS: Record<string, string> = {
  ativo: 'Ativo', afastado: 'Afastado', ferias: 'Férias', desligado: 'Desligado',
}

const STATUS_COLORS: Record<string, string> = {
  ativo: 'bg-green-100 text-green-700',
  afastado: 'bg-amber-100 text-amber-700',
  ferias: 'bg-orange-100 text-orange-700',
  desligado: 'bg-red-100 text-red-700',
}

// ─── Excel ────────────────────────────────────────────────────────────────────

function exportExcel(dados: EfetivoMesRow[], mes: number, ano: number, MESES: string[]) {
  const wb = XLSX.utils.book_new()
  const supervisores = Array.from(new Set(dados.map(r => r.supervisor))).sort()
  const HEADERS = ['Supervisor', 'Secretaria', 'Posto', 'Funcionário', 'Função', 'Status']
  const NC = HEADERS.length

  type XRow = { data: (string | number)[]; style?: 'groupHeader' | 'colHeader' | 'totals' }
  const rows: XRow[] = [
    { data: [`Efetivo por Posto/Mês — ${MESES[mes]} ${ano}`] },
    { data: [] },
  ]

  for (const sup of supervisores) {
    const grupoSup = dados.filter(r => r.supervisor === sup)
    rows.push({ data: [`${sup.toUpperCase()} (${grupoSup.length})`, ...Array(NC - 1).fill('')], style: 'groupHeader' })
    rows.push({ data: HEADERS, style: 'colHeader' })
    for (const r of grupoSup) {
      rows.push({ data: [sup, r.secretaria, r.posto_nome, r.nome, r.funcao, STATUS_LABELS[r.status] ?? r.status] })
    }
    rows.push({ data: [] })
  }

  const ws = XLSX.utils.aoa_to_sheet(rows.map(r => r.data))
  rows.forEach((row, ri) => {
    if (!row.style) return
    for (let ci = 0; ci < NC; ci++) {
      const addr = XLSX.utils.encode_cell({ r: ri, c: ci })
      if (!ws[addr]) ws[addr] = { v: '', t: 's' }
      if (row.style === 'groupHeader') {
        ws[addr].s = { fill: { patternType: 'solid', fgColor: { rgb: '1e293b' } }, font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 10 } }
      } else if (row.style === 'colHeader') {
        ws[addr].s = { font: { bold: true, color: { rgb: '475569' } }, fill: { patternType: 'solid', fgColor: { rgb: 'e2e8f0' } } }
      }
    }
  })

  ws['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 24 }, { wch: 30 }, { wch: 20 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Efetivo')
  XLSX.writeFile(wb, `postos-mes-${pad2(mes)}-${ano}.xlsx`)
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

async function exportPDF(dados: EfetivoMesRow[], mes: number, ano: number, MESES: string[]) {
  const { pdf } = await import('@react-pdf/renderer')
  const { PostosMesDoc } = await import('./postos-mes-pdf')
  const blob = await pdf(<PostosMesDoc dados={dados} mes={mes} ano={ano} MESES={MESES} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `postos-mes-${pad2(mes)}-${ano}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── component ────────────────────────────────────────────────────────────────

interface Props {
  dados: EfetivoMesRow[]
  mes: number
  ano: number
  MESES: string[]
  anos: number[]
}

export function PostosMesClient({ dados, mes, ano, MESES, anos }: Props) {
  const [loadingXlsx, setLoadingXlsx] = useState(false)
  const [loadingPdf,  setLoadingPdf]  = useState(false)

  const supervisores = Array.from(new Set(dados.map(r => r.supervisor))).sort()

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
        <a href="/relatorios/postos-mes" className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50">
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
        {dados.length} funcionário{dados.length !== 1 ? 's' : ''}
      </p>

      {dados.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm">
          <p className="text-sm text-gray-400">Nenhum registro encontrado para o período.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {supervisores.map(sup => {
            const grupoSup = dados.filter(r => r.supervisor === sup)
            const secretarias = Array.from(new Set(grupoSup.map(r => r.secretaria))).sort()
            return (
              <div key={sup} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="bg-slate-800 px-4 py-2.5">
                  <span className="text-xs font-bold uppercase tracking-widest text-white">
                    {sup} — {grupoSup.length} funcionário{grupoSup.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {secretarias.map(sec => {
                  const grupoSec = grupoSup.filter(r => r.secretaria === sec)
                  const postos = Array.from(new Set(grupoSec.map(r => r.posto_id)))
                  return (
                    <div key={sec}>
                      <div className="border-b border-gray-100 bg-slate-100 px-4 py-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                          {sec} ({grupoSec.length})
                        </span>
                      </div>
                      {postos.map(pid => {
                        const grupoP = grupoSec.filter(r => r.posto_id === pid)
                        const postoNome = grupoP[0]?.posto_nome ?? '—'
                        return (
                          <div key={pid}>
                            <div className="border-b border-t border-gray-50 bg-gray-50 px-4 py-1">
                              <span className="text-xs font-medium text-gray-500">{postoNome}</span>
                            </div>
                            <table className="w-full text-sm">
                              <tbody className="divide-y divide-gray-50">
                                {grupoP.map(r => (
                                  <tr key={r.funcionario_id} className="hover:bg-gray-50/60">
                                    <td className="px-4 py-2 font-medium text-gray-900 w-1/3">{r.nome}</td>
                                    <td className="px-3 py-2 text-gray-500 w-1/3">{r.funcao}</td>
                                    <td className="px-3 py-2 w-1/3">
                                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600')}>
                                        {STATUS_LABELS[r.status] ?? r.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
