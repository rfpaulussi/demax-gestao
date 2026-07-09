'use client'

import { useState } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx-js-style'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FechamentoFinanceiro } from './actions'

const sel = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

function pad2(n: number) { return String(n).padStart(2, '0') }

function fmtBRL(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Excel ────────────────────────────────────────────────────────────────────

function exportExcel(dados: FechamentoFinanceiro[], mes: number, ano: number, MESES: string[]) {
  const wb = XLSX.utils.book_new()
  const titulo = `Fechamento Financeiro — ${MESES[mes]} ${ano}`

  const secretarias = Array.from(new Set(dados.map(d => d.secretaria ?? 'Sem Secretaria')))
    .sort((a, b) => {
      if (a === 'AFASTADOS') return 1
      if (b === 'AFASTADOS') return -1
      return a.localeCompare(b, 'pt-BR')
    })

  const HEADERS = ['Funcionário', 'RE', 'Função', 'Posto', 'Regime', 'D.Úteis', 'D.Trabalhados', 'Sal.Bruto (mês)', 'Sal.Prop.', 'Custo Total (mês)', 'Custo Prop.']
  const NC = HEADERS.length

  type XRow = { data: (string | number)[]; style?: 'groupHeader' | 'colHeader' | 'totals' | 'semCusto' }
  const rows: XRow[] = [{ data: [titulo] }, { data: [] }]

  for (const sec of secretarias) {
    const grupo = dados.filter(d => (d.secretaria ?? 'Sem Secretaria') === sec)
    rows.push({ data: [sec.toUpperCase(), ...Array(NC - 1).fill('')], style: 'groupHeader' })
    rows.push({ data: HEADERS, style: 'colHeader' })
    for (const d of grupo) {
      rows.push({
        data: [
          d.funcionario_nome,
          d.registro ?? '—',
          d.funcao ?? '—',
          d.posto_nome ?? '—',
          d.regime,
          d.dias_uteis,
          d.dias_trabalhados,
          d.salario_bruto,
          d.salario_prop,
          d.custo_total ?? '—',
          d.custo_prop ?? '—',
        ],
        style: d.sem_custo ? 'semCusto' : undefined,
      })
    }
    const totalSalarioProp = grupo.reduce((s, d) => s + d.salario_prop, 0)
    const totalCustoProp   = grupo.reduce((s, d) => s + (d.custo_prop ?? 0), 0)
    rows.push({
      data: ['TOTAL', '', '', '', '',
        grupo.reduce((s, d) => s + d.dias_uteis, 0),
        grupo.reduce((s, d) => s + d.dias_trabalhados, 0),
        '', totalSalarioProp, '', totalCustoProp],
      style: 'totals',
    })
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
      } else if (row.style === 'totals') {
        ws[addr].s = { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'dde1e7' } } }
      } else if (row.style === 'semCusto') {
        ws[addr].s = { fill: { patternType: 'solid', fgColor: { rgb: 'fffbeb' } }, font: { color: { rgb: '92400e' } } }
      }
    }
  })

  ws['!cols'] = [
    { wch: 30 }, { wch: 10 }, { wch: 22 }, { wch: 24 }, { wch: 8 },
    { wch: 9 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Financeiro')
  XLSX.writeFile(wb, `fechamento-financeiro-${pad2(mes)}-${ano}.xlsx`)
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

async function exportPDF(dados: FechamentoFinanceiro[], mes: number, ano: number, MESES: string[]) {
  const { pdf } = await import('@react-pdf/renderer')
  const { FechamentoFinPdfDoc } = await import('@/components/fechamento-financeiro/fechamento-fin-pdf')
  const blob = await pdf(<FechamentoFinPdfDoc dados={dados} mes={mes} ano={ano} MESES={MESES} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fechamento-financeiro-${pad2(mes)}-${ano}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── component ────────────────────────────────────────────────────────────────

interface Props {
  dados: FechamentoFinanceiro[]
  mes: number
  ano: number
  secretarias: string[]
  MESES: string[]
  anos: number[]
}

export function FechamentoFinClient({ dados, mes, ano, secretarias, MESES, anos }: Props) {
  const [loadingXlsx, setLoadingXlsx] = useState(false)
  const [loadingPdf,  setLoadingPdf]  = useState(false)

  const secretariasOrdenadas = [...secretarias].sort((a, b) => {
    if (a === 'AFASTADOS') return 1
    if (b === 'AFASTADOS') return -1
    return a.localeCompare(b, 'pt-BR')
  })

  return (
    <>
      {/* Controles */}
      <div className="flex flex-wrap items-end gap-3">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Mês</label>
            <select name="mes" defaultValue={mes} className={sel}>
              {MESES.slice(1).map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Ano</label>
            <select name="ano" defaultValue={ano} className={sel}>
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <button type="submit" className="h-9 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700">
            Calcular
          </button>
        </form>

        <div className="ml-auto flex gap-2">
          <button
            onClick={async () => {
              setLoadingXlsx(true)
              try { exportExcel(dados, mes, ano, MESES) } finally { setLoadingXlsx(false) }
            }}
            disabled={loadingXlsx || dados.length === 0}
            className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            {loadingXlsx ? 'Gerando…' : 'Excel'}
          </button>
          <button
            onClick={async () => {
              setLoadingPdf(true)
              try { await exportPDF(dados, mes, ano, MESES) } finally { setLoadingPdf(false) }
            }}
            disabled={loadingPdf || dados.length === 0}
            className="flex h-9 items-center gap-2 rounded-lg bg-amber-500 px-3 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            {loadingPdf ? 'Gerando…' : 'PDF'}
          </button>
        </div>
      </div>

      {/* Tabela por secretaria */}
      {dados.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">
          Nenhum funcionário ativo no período.
        </div>
      ) : (
        <div className="space-y-6">
          {secretariasOrdenadas.map(sec => {
            const grupo = dados.filter(d => (d.secretaria ?? 'Sem Secretaria') === sec)
            const totalSalario = grupo.reduce((s, d) => s + d.salario_prop, 0)
            const totalCusto   = grupo.reduce((s, d) => s + (d.custo_prop ?? 0), 0)

            return (
              <div key={sec} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                {/* cabeçalho da secretaria */}
                <div className="flex items-center justify-between bg-slate-800 px-4 py-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-white">{sec}</span>
                  <span className="text-xs text-slate-400">{grupo.length} funcionário{grupo.length !== 1 ? 's' : ''}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-slate-50">
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Funcionário</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Função</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Posto</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-widest text-slate-500">Dias Trab./Úteis</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">Sal. Bruto Prop.</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">Custo Total Prop.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {grupo.map(d => (
                        <tr
                          key={d.funcionario_id}
                          className={cn(
                            'hover:bg-slate-50',
                            d.sem_custo && 'bg-amber-50 hover:bg-amber-100',
                          )}
                        >
                          <td className="px-4 py-2 font-medium text-gray-900">
                            <Link href={`/efetivo/${d.funcionario_id}`} className="hover:text-indigo-600 hover:underline">
                              {d.funcionario_nome}
                            </Link>
                            {d.registro && <span className="ml-1.5 text-xs text-gray-400">{d.registro}</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{d.funcao ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{d.posto_nome ?? '—'}</td>
                          <td className="px-3 py-2 text-center tabular-nums text-gray-700">
                            {d.dias_trabalhados}/{d.dias_uteis}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                            {fmtBRL(d.salario_prop)}
                          </td>
                          <td className={cn(
                            'px-3 py-2 text-right tabular-nums font-medium',
                            d.sem_custo ? 'text-amber-700' : 'text-indigo-700',
                          )}>
                            {d.custo_prop != null ? fmtBRL(d.custo_prop) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-slate-50 font-semibold">
                        <td className="px-4 py-2 text-gray-700" colSpan={4}>Total — {sec}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-800">{fmtBRL(totalSalario)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-indigo-700">{fmtBRL(totalCusto)}</td>
                      </tr>
                    </tfoot>
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
