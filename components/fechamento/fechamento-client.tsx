'use client'

import { useState } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx-js-style'
import { FileSpreadsheet, FileText, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FechamentoFuncionario, FechamentoPosto } from '@/app/(admin)/fechamento/actions'

const sel = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function pad2(n: number) { return String(n).padStart(2, '0') }

// ─── Excel multi-sheet ───────────────────────────────────────────────────────

function exportExcel(
  porFuncionario: FechamentoFuncionario[],
  porPosto: FechamentoPosto[],
  mes: number,
  ano: number,
  MESES: string[],
) {
  const wb = XLSX.utils.book_new()
  const titulo = `Fechamento — ${MESES[mes]} ${ano}`

  // ── Sheet 1: Por Funcionário ──
  {
    const HEADERS = ['Nome','Função','Posto','Secretaria','Regime','D.Úteis','Férias','Faltas','Atestados','Suspensão','Afastamento','Trabalhados','Insalubridade','Advertência']
    const NC = HEADERS.length
    const secretarias = Array.from(new Set(porFuncionario.map(f => f.secretaria ?? 'Sem Secretaria'))).sort()

    type XRow = { data: (string | number)[]; style?: 'groupHeader' | 'totals' | 'colHeader' }
    const rows: XRow[] = [{ data: [titulo] }, { data: [] }]

    for (const sec of secretarias) {
      const grupo = porFuncionario.filter(d => (d.secretaria ?? 'Sem Secretaria') === sec)
      rows.push({ data: [sec.toUpperCase(), ...Array(NC - 1).fill('')], style: 'groupHeader' })
      rows.push({ data: HEADERS, style: 'colHeader' })
      for (const f of grupo) {
        rows.push({ data: [
          f.funcionario_nome, f.funcao ?? '—', f.posto_nome ?? '—', f.secretaria ?? '—', f.regime,
          f.dias_uteis, f.ferias_dias || 0, f.faltas_dias || 0, f.atestados_dias || 0,
          f.dias_suspensao || 0, f.afastamento_dias || 0, f.dias_trabalhados,
          f.insalubridade_dias || 0,
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
        grupo.reduce((s, f) => s + (f.afastamento_dias || 0), 0),
        grupo.reduce((s, f) => s + f.dias_trabalhados, 0),
        grupo.reduce((s, f) => s + (f.insalubridade_dias || 0), 0),
        '',
      ], style: 'totals' })
      rows.push({ data: [] })
    }

    const ws = XLSX.utils.aoa_to_sheet(rows.map(r => r.data))
    rows.forEach((row, ri) => {
      if (!row.style) return
      for (let ci = 0; ci < NC; ci++) {
        const addr = XLSX.utils.encode_cell({ r: ri, c: ci })
        if (!ws[addr]) ws[addr] = { v: '', t: 's' }
        if (row.style === 'groupHeader') ws[addr].s = { fill: { patternType: 'solid', fgColor: { rgb: '1e293b' } }, font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 10 } }
        else if (row.style === 'totals')   ws[addr].s = { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'f1f5f9' } } }
        else if (row.style === 'colHeader') ws[addr].s = { font: { bold: true, color: { rgb: '475569' } }, fill: { patternType: 'solid', fgColor: { rgb: 'e2e8f0' } } }
      }
    })
    ws['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 24 }, { wch: 14 }, { wch: 7 }, ...Array(8).fill({ wch: 10 }), { wch: 13 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Por Funcionário')
  }

  // ── Sheet 2: Por Posto ──
  {
    const HEADERS_POSTO = ['Nome','Função','Tipo','Período Início','Período Fim','Dias no Posto','Advertência','Faltas','Atestados','Insalubridade']
    const NC = HEADERS_POSTO.length
    type XRow = { data: (string | number)[]; style?: 'secHeader' | 'postoHeader' | 'colHeader' | 'cobertura' | 'totals' }
    const rows: XRow[] = [{ data: [`Por Posto — ${titulo}`] }, { data: [] }]

    const secretarias = Array.from(new Set(porPosto.map(p => p.secretaria || 'Sem Secretaria'))).sort()
    for (const sec of secretarias) {
      const postosGrupo = porPosto.filter(p => (p.secretaria || 'Sem Secretaria') === sec)
      rows.push({ data: [sec.toUpperCase(), ...Array(NC - 1).fill('')], style: 'secHeader' })

      for (const posto of postosGrupo) {
        rows.push({ data: [`${posto.posto_nome} (${posto.regime})`, ...Array(NC - 1).fill('')], style: 'postoHeader' })
        rows.push({ data: HEADERS_POSTO, style: 'colHeader' })

        const titulares  = posto.funcionarios.filter(f => f.tipo === 'titular')
        const coberturas = posto.funcionarios.filter(f => f.tipo === 'cobertura')

        for (const f of titulares) {
          rows.push({ data: [
            f.funcionario_nome, f.funcao ?? '—', 'Titular',
            fmt(f.data_inicio_no_posto), fmt(f.data_fim_no_posto), f.dias_no_posto,
            f.tem_advertencia ? 'Sim' : '', f.faltas_dias || 0, f.atestados_dias || 0, f.insalubridade_dias || 0,
          ]})
        }
        for (const f of coberturas) {
          rows.push({ data: [
            f.funcionario_nome, f.funcao ?? '—', 'Cobertura',
            fmt(f.data_inicio_no_posto), fmt(f.data_fim_no_posto), f.dias_no_posto,
            '', '', '', '',
          ], style: 'cobertura' })
        }

        const totalTitulares = titulares.reduce((s, f) => s + f.dias_no_posto, 0)
        const totalCoberturas = coberturas.reduce((s, f) => s + f.dias_no_posto, 0)
        rows.push({ data: ['TOTAL', '', '', '', '', totalTitulares + totalCoberturas, '', '', '', ''], style: 'totals' })
        rows.push({ data: [] })
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows.map(r => r.data))
    rows.forEach((row, ri) => {
      if (!row.style) return
      for (let ci = 0; ci < NC; ci++) {
        const addr = XLSX.utils.encode_cell({ r: ri, c: ci })
        if (!ws[addr]) ws[addr] = { v: '', t: 's' }
        if (row.style === 'secHeader')   ws[addr].s = { fill: { patternType: 'solid', fgColor: { rgb: '1e293b' } }, font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 10 } }
        else if (row.style === 'postoHeader') ws[addr].s = { fill: { patternType: 'solid', fgColor: { rgb: '475569' } }, font: { color: { rgb: 'FFFFFF' }, bold: true } }
        else if (row.style === 'colHeader')   ws[addr].s = { font: { bold: true, color: { rgb: '475569' } }, fill: { patternType: 'solid', fgColor: { rgb: 'e2e8f0' } } }
        else if (row.style === 'cobertura')   ws[addr].s = { fill: { patternType: 'solid', fgColor: { rgb: 'fef9c3' } } }
        else if (row.style === 'totals')      ws[addr].s = { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'f1f5f9' } } }
      }
    })
    ws['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Por Posto')
  }

  // ── Sheet 3: Coberturas ──
  {
    const HEADERS = ['Funcionário','Função','Posto Origem','Posto Destino','Secretaria Destino','Início','Fim','Dias']
    const NC = HEADERS.length
    type XRow = { data: (string | number)[]; style?: 'header' }
    const rows: XRow[] = [
      { data: [`Coberturas — ${titulo}`] },
      { data: [] },
      { data: HEADERS, style: 'header' },
    ]

    for (const f of porFuncionario) {
      for (const c of f.coberturas_prestadas) {
        rows.push({ data: [
          f.funcionario_nome, f.funcao ?? '—',
          f.posto_nome ?? '—', c.posto_nome, c.secretaria,
          fmt(c.data_inicio), fmt(c.data_fim), c.dias_no_posto,
        ]})
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows.map(r => r.data))
    rows.forEach((row, ri) => {
      if (row.style !== 'header') return
      for (let ci = 0; ci < NC; ci++) {
        const addr = XLSX.utils.encode_cell({ r: ri, c: ci })
        if (!ws[addr]) ws[addr] = { v: '', t: 's' }
        ws[addr].s = { font: { bold: true, color: { rgb: '475569' } }, fill: { patternType: 'solid', fgColor: { rgb: 'e2e8f0' } } }
      }
    })
    ws['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 24 }, { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 8 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Coberturas')
  }

  XLSX.writeFile(wb, `fechamento-${pad2(mes)}-${ano}.xlsx`)
}

// ─── PDF exports ──────────────────────────────────────────────────────────────

async function exportPDFFuncionarios(dados: FechamentoFuncionario[], mes: number, ano: number, MESES: string[]) {
  const { pdf }              = await import('@react-pdf/renderer')
  const { FechamentoPDFDoc } = await import('./fechamento-pdf-doc')
  const blob = await pdf(<FechamentoPDFDoc dados={dados} mes={mes} ano={ano} MESES={MESES} />).toBlob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `fechamento-funcionarios-${pad2(mes)}-${ano}.pdf`
  a.click()
}

async function exportPDFPorPosto(porPosto: FechamentoPosto[], mes: number, ano: number, MESES: string[]) {
  const { pdf }                  = await import('@react-pdf/renderer')
  const { FechamentoPorPostoPDF } = await import('./fechamento-pdf-doc')
  const blob = await pdf(<FechamentoPorPostoPDF porPosto={porPosto} mes={mes} ano={ano} MESES={MESES} />).toBlob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `fechamento-postos-${pad2(mes)}-${ano}.pdf`
  a.click()
}

// ─── Tab: Por Funcionário ─────────────────────────────────────────────────────

function TabFuncionarios({ dados, mostrarVazias }: { dados: FechamentoFuncionario[]; mostrarVazias: boolean }) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sorted = sortCol ? [...dados].sort((a, b) => {
    const map: Record<string, number> = {
      nome:          a.funcionario_nome.localeCompare(b.funcionario_nome),
      uteis:         a.dias_uteis - b.dias_uteis,
      ferias:        a.ferias_dias - b.ferias_dias,
      faltas:        a.faltas_dias - b.faltas_dias,
      atestados:     a.atestados_dias - b.atestados_dias,
      trabalhados:   a.dias_trabalhados - b.dias_trabalhados,
      insalubridade: a.insalubridade_dias - b.insalubridade_dias,
    }
    return sortDir === 'asc' ? (map[sortCol] ?? 0) : -(map[sortCol] ?? 0)
  }) : dados

  if (dados.length === 0) {
    return <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm"><p className="text-sm text-gray-400">Nenhum funcionário encontrado.</p></div>
  }

  const Th = ({ col, label, center }: { col: string; label: string; center?: boolean }) => (
    <th onClick={() => toggleSort(col)} className={cn('cursor-pointer select-none px-3 py-3 text-xs font-semibold uppercase tracking-widest text-gray-400 hover:text-gray-600', center ? 'text-center' : 'text-left')}>
      {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : <span className="text-gray-300">↕</span>}
    </th>
  )

  return (
    <div className="w-full rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
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
              <Th col="uteis"         label="D.Úteis"     center />
              <Th col="ferias"        label="Férias"      center />
              <Th col="faltas"        label="Faltas"      center />
              <Th col="atestados"     label="Atestados"   center />
              {mostrarVazias && <th className="min-w-[70px] px-3 py-3 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">Suspensão</th>}
              {mostrarVazias && <th className="min-w-[70px] px-3 py-3 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">Afastamento</th>}
              <Th col="trabalhados"   label="Trabalhados" center />
              <Th col="insalubridade" label="Insalubridade" center />
              <th className="min-w-[90px] px-3 py-3 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">Advertência</th>
              <th className="min-w-[160px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Coberturas no mês</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map(f => (
              <tr key={f.funcionario_id} className={cn(
                'transition-colors hover:bg-gray-50/80',
                f.tem_suspensao ? 'bg-red-50/40' : f.faltas_dias > 0 ? 'bg-red-50/20' : f.ferias_dias > 0 ? 'bg-orange-50/30' : f.afastamento_dias > 0 ? 'bg-gray-50/60' : null,
              )}>
                <td className={cn(
                  'sticky left-0 z-10 px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap',
                  f.data_desligamento && 'text-gray-400',
                  f.tem_suspensao ? 'bg-red-50/40' : f.faltas_dias > 0 ? 'bg-red-50/20' : f.ferias_dias > 0 ? 'bg-orange-50/30' : f.afastamento_dias > 0 ? 'bg-gray-50/60' : 'bg-white',
                )}>
                  {f.funcionario_nome}
                  {f.data_desligamento && <span className="ml-1.5 inline-block rounded bg-gray-100 px-1 py-0.5 text-[10px] font-medium text-gray-500">desligado {fmt(f.data_desligamento)}</span>}
                </td>
                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{f.funcao ?? '—'}</td>
                <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{f.posto_nome ?? '—'}</td>
                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{f.secretaria ?? '—'}</td>
                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">{fmt(f.periodo_inicio)} – {fmt(f.periodo_fim)} <span className="text-gray-400">({f.dias_calendario}d)</span></td>
                <td className="px-3 py-2.5 text-center text-xs font-mono text-gray-500">{f.regime}</td>
                <td className="px-3 py-2.5 text-center font-mono text-gray-700">{f.dias_uteis}</td>
                <td className="px-3 py-2.5 text-center">{f.ferias_dias > 0 ? <span className="font-mono text-orange-600">{f.ferias_dias}</span> : <span className="text-gray-300">—</span>}</td>
                <td className="px-3 py-2.5 text-center">{f.faltas_dias > 0 ? <span className="font-mono text-red-600">{f.faltas_dias}</span> : <span className="text-gray-300">—</span>}</td>
                <td className="px-3 py-2.5 text-center">{f.atestados_dias > 0 ? <span className="font-mono text-amber-600">{f.atestados_dias}</span> : <span className="text-gray-300">—</span>}</td>
                {mostrarVazias && <td className="px-3 py-2.5 text-center">{f.dias_suspensao > 0 ? <span className="font-mono text-red-700 font-semibold">{f.dias_suspensao}</span> : <span className="text-gray-300">—</span>}</td>}
                {mostrarVazias && <td className="px-3 py-2.5 text-center">{f.afastamento_dias > 0 ? <span className="font-mono text-gray-600">{f.afastamento_dias}</span> : <span className="text-gray-300">—</span>}</td>}
                <td className="px-3 py-2.5 text-center">
                  <span className="inline-flex items-center justify-center rounded-full bg-blue-50 px-2.5 py-0.5 font-mono text-sm font-bold text-blue-700">{f.dias_trabalhados}</span>
                </td>
                <td className="px-3 py-2.5 text-center">{f.insalubridade_dias > 0 ? <span className="font-mono text-purple-600">{f.insalubridade_dias}</span> : <span className="text-gray-300">—</span>}</td>
                <td className="px-3 py-2.5 text-center">
                  {f.tem_suspensao ? <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Suspensão</span>
                  : f.tem_advertencia ? <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Sim</span>
                  : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  {f.coberturas_prestadas.length > 0 ? (
                    <div className="space-y-0.5">
                      {f.coberturas_prestadas.map((c, i) => (
                        <div key={i} className="text-xs text-indigo-600 whitespace-nowrap">
                          {c.posto_nome} <span className="text-gray-400">({fmt(c.data_inicio)}–{fmt(c.data_fim)}, {c.dias_no_posto}d)</span>
                        </div>
                      ))}
                    </div>
                  ) : <span className="text-gray-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab: Por Posto ───────────────────────────────────────────────────────────

function TabPorPosto({ porPosto }: { porPosto: FechamentoPosto[] }) {
  const secretarias = Array.from(new Set(porPosto.map(p => p.secretaria || 'Sem Secretaria'))).sort()

  if (porPosto.length === 0) {
    return <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm"><p className="text-sm text-gray-400">Nenhum dado encontrado.</p></div>
  }

  return (
    <div className="space-y-6">
      {secretarias.map(sec => {
        const postosGrupo = porPosto.filter(p => (p.secretaria || 'Sem Secretaria') === sec)
        const totalDias = postosGrupo.reduce((s, p) => s + p.funcionarios.reduce((s2, f) => s2 + f.dias_no_posto, 0), 0)
        const totalFunc = new Set(postosGrupo.flatMap(p => p.funcionarios.map(f => f.funcionario_id))).size

        return (
          <div key={sec}>
            <div className="mb-3 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-bold uppercase tracking-widest text-slate-700">{sec}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{totalFunc} pessoas · {totalDias} dias</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <div className="space-y-3">
              {postosGrupo.map(posto => {
                const titulares  = posto.funcionarios.filter(f => f.tipo === 'titular')
                const coberturas = posto.funcionarios.filter(f => f.tipo === 'cobertura')
                const totalDiasPosto = posto.funcionarios.reduce((s, f) => s + f.dias_no_posto, 0)

                return (
                  <div key={posto.posto_id} className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between border-b border-gray-100 bg-slate-50 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-800">{posto.posto_nome}</span>
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">{posto.regime}</span>
                      </div>
                      <span className="text-xs text-slate-500">{totalDiasPosto} dias totais · {titulares.length} titular{titulares.length !== 1 ? 'es' : ''}{coberturas.length > 0 ? ` · ${coberturas.length} cobertura${coberturas.length !== 1 ? 's' : ''}` : ''}</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-50 bg-gray-50/50">
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Funcionário</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Função</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">Tipo</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">Período</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">Dias</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">Ocorrências</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {titulares.map(f => (
                          <tr key={f.funcionario_id + '-t'} className="hover:bg-gray-50/60">
                            <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">{f.funcionario_nome}</td>
                            <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{f.funcao ?? '—'}</td>
                            <td className="px-4 py-2 text-center">
                              <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">Titular</span>
                            </td>
                            <td className="px-4 py-2 text-center text-xs text-gray-500 whitespace-nowrap">{fmt(f.data_inicio_no_posto)} – {fmt(f.data_fim_no_posto)}</td>
                            <td className="px-4 py-2 text-center">
                              <span className="font-mono font-bold text-blue-700">{f.dias_no_posto}</span>
                            </td>
                            <td className="px-4 py-2 text-center text-xs space-x-1">
                              {f.tem_advertencia && <span className="inline-block rounded bg-amber-100 px-1.5 text-amber-700">Adv</span>}
                              {f.faltas_dias > 0 && <span className="inline-block rounded bg-red-100 px-1.5 text-red-700">{f.faltas_dias}F</span>}
                              {f.atestados_dias > 0 && <span className="inline-block rounded bg-orange-100 px-1.5 text-orange-700">{f.atestados_dias}At</span>}
                              {f.insalubridade_dias > 0 && <span className="inline-block rounded bg-purple-100 px-1.5 text-purple-700">{f.insalubridade_dias}In</span>}
                              {!f.tem_advertencia && f.faltas_dias === 0 && f.atestados_dias === 0 && f.insalubridade_dias === 0 && <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        ))}
                        {coberturas.map((f, i) => (
                          <tr key={f.funcionario_id + '-c-' + i} className="bg-yellow-50/40 hover:bg-yellow-50/60">
                            <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{f.funcionario_nome}</td>
                            <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{f.funcao ?? '—'}</td>
                            <td className="px-4 py-2 text-center">
                              <span className="inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">Cobertura</span>
                            </td>
                            <td className="px-4 py-2 text-center text-xs text-gray-500 whitespace-nowrap">{fmt(f.data_inicio_no_posto)} – {fmt(f.data_fim_no_posto)}</td>
                            <td className="px-4 py-2 text-center">
                              <span className="font-mono font-bold text-yellow-700">{f.dias_no_posto}</span>
                            </td>
                            <td className="px-4 py-2 text-center text-gray-300 text-xs">—</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Tab: Por Secretaria ──────────────────────────────────────────────────────

function TabPorSecretaria({ porFuncionario, porPosto }: { porFuncionario: FechamentoFuncionario[]; porPosto: FechamentoPosto[] }) {
  const secretarias = Array.from(new Set(porFuncionario.map(f => f.secretaria).filter(Boolean) as string[])).sort()

  if (secretarias.length === 0) {
    return <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm"><p className="text-sm text-gray-400">Nenhum dado encontrado.</p></div>
  }

  return (
    <div className="space-y-8">
      {secretarias.map(sec => {
        const funcs   = porFuncionario.filter(f => f.secretaria === sec)
        const postos  = porPosto.filter(p => p.secretaria === sec)
        const totalTrabalhados  = funcs.reduce((s, f) => s + f.dias_trabalhados, 0)
        const totalFaltas       = funcs.reduce((s, f) => s + f.faltas_dias, 0)
        const totalAtestados    = funcs.reduce((s, f) => s + f.atestados_dias, 0)
        const totalFerias       = funcs.reduce((s, f) => s + f.ferias_dias, 0)
        const totalInsalub      = funcs.filter(f => f.insalubridade_dias > 0).length
        const totalAdvertencias = funcs.filter(f => f.tem_advertencia).length
        const totalCoberturas   = funcs.reduce((s, f) => s + f.coberturas_prestadas.length, 0)

        return (
          <div key={sec} className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="border-b-4 border-slate-800 bg-slate-800 px-5 py-4">
              <h2 className="font-bold text-white text-base tracking-wide">{sec}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{funcs.length} funcionários · {postos.length} postos</p>
            </div>

            <div className="grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-4 lg:grid-cols-7">
              {[
                { label: 'Dias Trabalhados', value: totalTrabalhados, color: 'text-blue-700' },
                { label: 'Faltas',           value: totalFaltas,       color: totalFaltas > 0 ? 'text-red-600' : 'text-gray-400' },
                { label: 'Atestados',        value: totalAtestados,    color: totalAtestados > 0 ? 'text-amber-600' : 'text-gray-400' },
                { label: 'Férias',           value: totalFerias,       color: totalFerias > 0 ? 'text-orange-600' : 'text-gray-400' },
                { label: 'Insalubridade',    value: totalInsalub,      color: totalInsalub > 0 ? 'text-purple-600' : 'text-gray-400' },
                { label: 'Advertências',     value: totalAdvertencias, color: totalAdvertencias > 0 ? 'text-amber-700' : 'text-gray-400' },
                { label: 'Coberturas',       value: totalCoberturas,   color: totalCoberturas > 0 ? 'text-indigo-600' : 'text-gray-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white px-4 py-3">
                  <p className={cn('text-xl font-black', color)}>{value}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            <div className="p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">Postos ({postos.length})</p>
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {postos.map(p => {
                  const titulares  = p.funcionarios.filter(f => f.tipo === 'titular').length
                  const coberturas = p.funcionarios.filter(f => f.tipo === 'cobertura').length
                  const totalDias  = p.funcionarios.reduce((s, f) => s + f.dias_no_posto, 0)
                  return (
                    <div key={p.posto_id} className="rounded-lg border border-gray-100 px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{p.posto_nome}</p>
                        <p className="text-[10px] text-gray-400">{titulares} titular{titulares !== 1 ? 'es' : ''}{coberturas > 0 ? ` · ${coberturas} cob.` : ''}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-blue-700">{totalDias}</p>
                        <p className="text-[10px] text-gray-400">{p.regime}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  porFuncionario: FechamentoFuncionario[]
  porPosto: FechamentoPosto[]
  mes: number
  ano: number
  secretariaAtiva: string
  secretarias: string[]
  MESES: string[]
  anos: number[]
}

type Tab = 'funcionarios' | 'porposto' | 'secretaria'

export function FechamentoClient({ porFuncionario, porPosto, mes, ano, secretariaAtiva, secretarias, MESES, anos }: Props) {
  const [activeTab,    setActiveTab]    = useState<Tab>('funcionarios')
  const [loadingXlsx, setLoadingXlsx]  = useState(false)
  const [loadingPdf1, setLoadingPdf1]  = useState(false)
  const [loadingPdf2, setLoadingPdf2]  = useState(false)
  const [mostrarVazias, setMostrarVazias] = useState(false)

  async function handleExcel() {
    setLoadingXlsx(true)
    try { exportExcel(porFuncionario, porPosto, mes, ano, MESES) } finally { setLoadingXlsx(false) }
  }

  async function handlePDF1() {
    setLoadingPdf1(true)
    try { await exportPDFFuncionarios(porFuncionario, mes, ano, MESES) } finally { setLoadingPdf1(false) }
  }

  async function handlePDF2() {
    setLoadingPdf2(true)
    try { await exportPDFPorPosto(porPosto, mes, ano, MESES) } finally { setLoadingPdf2(false) }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'funcionarios', label: 'Por Funcionário' },
    { id: 'porposto',     label: 'Por Posto'       },
    { id: 'secretaria',   label: 'Por Secretaria'  },
  ]

  return (
    <>
      {/* Filtros */}
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
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Secretaria</label>
          <select name="secretaria" defaultValue={secretariaAtiva} className={sel}>
            <option value="">Todas</option>
            {secretarias.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button type="submit" className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700">Filtrar</button>
        <a href="/fechamento" className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50">Limpar</a>

        <div className="ml-auto flex items-end gap-2">
          <button type="button" onClick={handleExcel} disabled={loadingXlsx || porFuncionario.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40">
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            {loadingXlsx ? 'Gerando…' : 'Excel'}
          </button>
          <button type="button" onClick={handlePDF1} disabled={loadingPdf1 || porFuncionario.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-40">
            <FileText className="h-4 w-4" />
            {loadingPdf1 ? 'Gerando…' : 'PDF Funcionários'}
          </button>
          <button type="button" onClick={handlePDF2} disabled={loadingPdf2 || porPosto.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-amber-400 px-3 text-sm font-medium text-slate-900 hover:bg-amber-300 disabled:opacity-40">
            <FileText className="h-4 w-4" />
            {loadingPdf2 ? 'Gerando…' : 'PDF Por Posto'}
          </button>
          <Link href="/fechamento/config-escalas" className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Settings2 className="h-4 w-4 text-slate-500" />
            Escalas
          </Link>
        </div>
      </form>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-slate-800 text-slate-900'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {tab.label}
          </button>
        ))}
        {activeTab === 'funcionarios' && (
          <button type="button" onClick={() => setMostrarVazias(v => !v)}
            className="ml-auto text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600 pb-2.5">
            {mostrarVazias ? 'Ocultar colunas extras' : 'Mostrar todas colunas'}
          </button>
        )}
        <span className="ml-auto pb-2.5 text-xs font-semibold uppercase tracking-widest text-gray-400">
          {porFuncionario.length} funcionário{porFuncionario.length !== 1 ? 's' : ''}
        </span>
      </div>

      {activeTab === 'funcionarios' && <TabFuncionarios dados={porFuncionario} mostrarVazias={mostrarVazias} />}
      {activeTab === 'porposto'     && <TabPorPosto porPosto={porPosto} />}
      {activeTab === 'secretaria'   && <TabPorSecretaria porFuncionario={porFuncionario} porPosto={porPosto} />}
    </>
  )
}
