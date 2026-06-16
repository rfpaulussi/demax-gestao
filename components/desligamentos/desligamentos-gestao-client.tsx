'use client'

import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx-js-style'
import { FileSpreadsheet, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import type { DesligadoRow } from '@/app/(admin)/desligamentos/actions'
import { TIPOS_DESLIGAMENTO, MOTIVOS_POR_TIPO } from '@/components/efetivo/modal-desligar'

const sel = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmtTempoCasa(dias: number | null): string {
  if (dias === null) return '—'
  if (dias < 30)  return `${dias}d`
  if (dias < 365) return `${Math.floor(dias / 30)}m`
  const anos  = Math.floor(dias / 365)
  const meses = Math.floor((dias % 365) / 30)
  return meses > 0 ? `${anos}a ${meses}m` : `${anos}a`
}

const TIPO_MAP    = Object.fromEntries(TIPOS_DESLIGAMENTO.map(t => [t.value, t.label]))
const TODOS_MOTIVOS = Object.fromEntries(Object.values(MOTIVOS_POR_TIPO).flat().map(m => [m.value, m.label]))

const TIPO_CHIP: Record<string, string> = {
  voluntaria:          'bg-blue-50 text-blue-700',
  demissao:            'bg-red-50 text-red-700',
  reprova_experiencia: 'bg-amber-50 text-amber-700',
  judicial:            'bg-purple-50 text-purple-700',
  outros:              'bg-gray-100 text-gray-500',
}

function exportExcel(rows: DesligadoRow[], dataInicio: string, dataFim: string) {
  const wb = XLSX.utils.book_new()
  const HEADERS = ['Funcionário','Matrícula','Posto','Secretaria','Supervisor','Admissão','Desligamento','Tempo de Casa','Tipo','Motivação']
  const NC = HEADERS.length

  type XRow = { data: (string | number)[]; style?: 'colHeader' }
  const allRows: XRow[] = [
    { data: [`Desligamentos — ${fmt(dataInicio)} a ${fmt(dataFim)}`] },
    { data: [] },
    { data: HEADERS, style: 'colHeader' },
  ]

  for (const r of rows) {
    allRows.push({ data: [
      r.nome, r.registro ?? '—', r.posto_nome, r.secretaria, r.supervisor,
      fmt(r.data_admissao), fmt(r.data_desligamento), fmtTempoCasa(r.tempo_casa_dias),
      TIPO_MAP[r.tipo_desligamento ?? ''] ?? r.tipo_desligamento ?? '—',
      TODOS_MOTIVOS[r.motivo_desligamento ?? ''] ?? r.motivo_desligamento ?? '—',
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
  ws['!cols'] = [{ wch: 30 },{ wch: 14 },{ wch: 28 },{ wch: 14 },{ wch: 22 },{ wch: 12 },{ wch: 14 },{ wch: 14 },{ wch: 22 },{ wch: 26 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Desligamentos')
  XLSX.writeFile(wb, `desligamentos-${dataInicio}-${dataFim}.xlsx`)
}

interface Props { rows: DesligadoRow[]; dataInicio: string; dataFim: string }

export function DesligamentosGestaoClient({ rows, dataInicio, dataFim }: Props) {
  const [filtroTipo,    setFiltroTipo]    = useState('')
  const [filtroSecret,  setFiltroSecret]  = useState('')
  const [busca,         setBusca]         = useState('')
  const [loadingXlsx,   setLoadingXlsx]   = useState(false)

  const secretarias = useMemo(
    () => Array.from(new Set(rows.map(r => r.secretaria).filter(Boolean))).sort(),
    [rows],
  )

  const filtered = useMemo(() => {
    let list = rows
    if (filtroTipo)   list = list.filter(r => r.tipo_desligamento === filtroTipo)
    if (filtroSecret) list = list.filter(r => r.secretaria === filtroSecret)
    if (busca) {
      const q = busca.toLowerCase()
      list = list.filter(r => r.nome.toLowerCase().includes(q) || (r.registro ?? '').includes(q))
    }
    return list
  }, [rows, filtroTipo, filtroSecret, busca])

  return (
    <>
      {/* Filtros de período — GET */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">De</label>
          <input type="date" name="inicio" defaultValue={dataInicio} className={sel} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Até</label>
          <input type="date" name="fim" defaultValue={dataFim} className={sel} />
        </div>
        <button type="submit" className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700">
          Filtrar
        </button>
        <a href="/desligamentos" className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50">
          Limpar
        </a>
      </form>

      {/* Filtros client-side */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar por nome ou matrícula..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400 w-64"
        />
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className={sel}>
          <option value="">Todos os tipos</option>
          {TIPOS_DESLIGAMENTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filtroSecret} onChange={e => setFiltroSecret(e.target.value)} className={sel}>
          <option value="">Todas as secretarias</option>
          {secretarias.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <button
          type="button"
          onClick={() => { setLoadingXlsx(true); try { exportExcel(filtered, dataInicio, dataFim) } finally { setLoadingXlsx(false) } }}
          disabled={loadingXlsx || filtered.length === 0}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          {loadingXlsx ? 'Gerando…' : 'Excel'}
        </button>
      </div>

      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm">
          <p className="text-sm text-gray-400">Nenhum desligamento no período.</p>
        </div>
      ) : (
        <div className="w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm" style={{ minWidth: '1100px' }}>
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Funcionário','Matrícula','Posto','Secretaria','Supervisor','Admissão','Desligamento','Tempo de Casa','TIPO','MOTIVAÇÃO',''].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50/80">
                    <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{r.nome}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-400 whitespace-nowrap">{r.registro ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.posto_nome}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.secretaria}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.supervisor}</td>
                    <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{fmt(r.data_admissao)}</td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmt(r.data_desligamento)}</td>
                    <td className="px-3 py-2.5 text-center font-mono text-xs font-semibold text-gray-700 whitespace-nowrap">{fmtTempoCasa(r.tempo_casa_dias)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.tipo_desligamento ? (
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TIPO_CHIP[r.tipo_desligamento] ?? 'bg-gray-100 text-gray-500'}`}>
                          {TIPO_MAP[r.tipo_desligamento] ?? r.tipo_desligamento}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                      {TODOS_MOTIVOS[r.motivo_desligamento ?? ''] ?? r.motivo_desligamento ?? '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/efetivo/${r.id}`}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Prontuário
                      </Link>
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
