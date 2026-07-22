'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as XLSX from 'xlsx-js-style'
import { FileSpreadsheet, FileText, Save, Calculator } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FechamentoFinanceiro, ResumoFechamento } from './actions'
import { salvarResumoFechamento } from './actions'
import { EvolucaoChart } from '@/components/fechamento-financeiro/evolucao-chart'
import { MemoriaCalculoDialog } from '@/components/fechamento-financeiro/memoria-calculo-dialog'

const sel = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

function pad2(n: number) { return String(n).padStart(2, '0') }

function fmtBRL(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Agrupamento ─────────────────────────────────────────────────────────────

type AgrupKey = 'secretaria' | 'funcao' | 'posto'
type Grupo = { label: string; items: FechamentoFinanceiro[]; isAfastados: boolean }

function computeGrupos(dados: FechamentoFinanceiro[], agrup: AgrupKey): Grupo[] {
  const ativos    = dados.filter(d => !d.is_afastado)
  const afastados = dados.filter(d => d.is_afastado)

  const getKey = (d: FechamentoFinanceiro) => {
    if (agrup === 'secretaria') return d.secretaria ?? 'Sem Secretaria'
    if (agrup === 'funcao')     return d.funcao ?? 'Sem Função'
    return d.posto_nome ?? 'Sem Posto'
  }

  const map = new Map<string, FechamentoFinanceiro[]>()
  for (const d of ativos) {
    const k = getKey(d)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(d)
  }

  const grupos: Grupo[] = Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([label, items]) => ({ label, items, isAfastados: false }))

  if (afastados.length > 0) {
    grupos.push({ label: 'AFASTADOS', items: afastados, isAfastados: true })
  }
  return grupos
}

// ─── Excel ────────────────────────────────────────────────────────────────────

function exportExcel(
  dados: FechamentoFinanceiro[],
  mes: number, ano: number, MESES: string[],
  ativos: number, custoTotal: number, salarioTotal: number,
  emFerias: number, diasFerias: number, custoFerias: number,
  afastados: number,
) {
  const wb    = XLSX.utils.book_new()
  const titulo = `Fechamento Financeiro — ${MESES[mes]} ${ano}`

  // ── Aba Financeiro (por secretaria) ─────────────────────────────────────────
  const secretarias = Array.from(new Set(dados.map(d => d.secretaria ?? 'Sem Secretaria')))
    .sort((a, b) => {
      if (a === 'AFASTADOS') return 1
      if (b === 'AFASTADOS') return -1
      return a.localeCompare(b, 'pt-BR')
    })

  const HEADERS = [
    'Funcionário','RE','Função','Posto','Regime',
    'D.Úteis','D.Trabalhados','D.Férias',
    'Sal.Bruto (mês)','Sal.Prop.','Custo Total (mês)','Custo Prop.','Custo ⅓ Férias',
  ]
  const NC = HEADERS.length

  type XRow = { data: (string | number)[]; style?: 'groupHeader' | 'groupHeaderGray' | 'colHeader' | 'totals' | 'semCusto' | 'afastado' | 'ferias' }
  const rows: XRow[] = [{ data: [titulo] }, { data: [] }]

  for (const sec of secretarias) {
    const grupo       = dados.filter(d => (d.secretaria ?? 'Sem Secretaria') === sec)
    const isAfastados = sec.toUpperCase() === 'AFASTADOS'
    const headerLabel = isAfastados ? `${sec.toUpperCase()}   (custo não computado)` : sec.toUpperCase()

    rows.push({ data: [headerLabel, ...Array(NC - 1).fill('')], style: isAfastados ? 'groupHeaderGray' : 'groupHeader' })
    rows.push({ data: HEADERS, style: 'colHeader' })

    for (const d of grupo) {
      rows.push({
        data: [
          d.em_ferias ? `${d.funcionario_nome} [Férias ${d.dias_ferias}d]` : d.funcionario_nome,
          d.registro ?? '—',
          d.funcao ?? '—',
          d.posto_nome ?? '—',
          d.regime,
          isAfastados ? '—' : d.dias_uteis,
          isAfastados ? '—' : d.dias_trabalhados,
          isAfastados ? '—' : (d.dias_ferias > 0 ? d.dias_ferias : ''),
          d.salario_bruto > 0 ? d.salario_bruto : '—',
          isAfastados ? '—' : d.salario_prop,
          isAfastados ? '—' : (d.custo_total ?? '—'),
          isAfastados ? '—' : (d.custo_prop ?? '—'),
          isAfastados ? '—' : (d.custo_ferias_extra > 0 ? d.custo_ferias_extra : ''),
        ],
        style: isAfastados ? 'afastado' : d.sem_custo ? 'semCusto' : d.em_ferias ? 'ferias' : undefined,
      })
    }

    const totalSalarioProp = isAfastados ? 0 : grupo.reduce((s, d) => s + d.salario_prop, 0)
    const totalCustoProp   = isAfastados ? 0 : grupo.reduce((s, d) => s + (d.custo_prop ?? 0), 0)
    const totalDiasFerias  = isAfastados ? 0 : grupo.reduce((s, d) => s + d.dias_ferias, 0)
    const totalCustoFerias = isAfastados ? 0 : grupo.reduce((s, d) => s + d.custo_ferias_extra, 0)

    rows.push({
      data: ['TOTAL','','','','',
        isAfastados ? '—' : grupo.reduce((s, d) => s + d.dias_uteis, 0),
        isAfastados ? '—' : grupo.reduce((s, d) => s + d.dias_trabalhados, 0),
        isAfastados ? '—' : totalDiasFerias,
        '',
        isAfastados ? '—' : totalSalarioProp,
        '',
        isAfastados ? '—' : totalCustoProp,
        isAfastados ? '—' : totalCustoFerias,
      ],
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
      if (row.style === 'groupHeader')     ws[addr].s = { fill: { patternType: 'solid', fgColor: { rgb: '1e293b' } }, font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 10 } }
      else if (row.style === 'groupHeaderGray') ws[addr].s = { fill: { patternType: 'solid', fgColor: { rgb: '6b7280' } }, font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 10 } }
      else if (row.style === 'colHeader')  ws[addr].s = { font: { bold: true, color: { rgb: '475569' } }, fill: { patternType: 'solid', fgColor: { rgb: 'e2e8f0' } } }
      else if (row.style === 'totals')     ws[addr].s = { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'dde1e7' } } }
      else if (row.style === 'semCusto')   ws[addr].s = { fill: { patternType: 'solid', fgColor: { rgb: 'fffbeb' } }, font: { color: { rgb: '92400e' } } }
      else if (row.style === 'afastado')   ws[addr].s = { fill: { patternType: 'solid', fgColor: { rgb: 'f3f4f6' } }, font: { color: { rgb: '9ca3af' } } }
      else if (row.style === 'ferias')     ws[addr].s = { fill: { patternType: 'solid', fgColor: { rgb: 'fff7ed' } }, font: { color: { rgb: 'c2410c' } } }
    }
  })
  ws['!cols'] = [
    { wch: 30 },{ wch: 10 },{ wch: 22 },{ wch: 24 },{ wch: 8 },
    { wch: 9 },{ wch: 12 },{ wch: 9 },
    { wch: 16 },{ wch: 14 },{ wch: 18 },{ wch: 14 },{ wch: 14 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Financeiro')

  // ── Aba Resumo ───────────────────────────────────────────────────────────────
  const resumoRows = [
    [`Fechamento Financeiro — ${MESES[mes]} ${ano}`],
    [],
    ['INDICADOR', 'VALOR'],
    ['Custo Total Proporcional', custoTotal],
    ['Salários Proporcionais', salarioTotal],
    ['Funcionários Ativos', ativos],
    ['Afastados (excluídos)', afastados],
    ['Em Férias', emFerias],
    ['Dias Úteis de Férias', diasFerias],
    ['Custo Extra ⅓ Férias', custoFerias],
    ['Custo Médio por Funcionário', ativos > 0 ? Math.round(custoTotal / ativos * 100) / 100 : 0],
  ]
  const wsR = XLSX.utils.aoa_to_sheet(resumoRows)
  wsR['!cols'] = [{ wch: 34 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsR, 'Resumo')

  XLSX.writeFile(wb, `fechamento-financeiro-${pad2(mes)}-${ano}.xlsx`)
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

async function exportPDF(dados: FechamentoFinanceiro[], mes: number, ano: number, MESES: string[]) {
  const { pdf }                = await import('@react-pdf/renderer')
  const { FechamentoFinPdfDoc } = await import('@/components/fechamento-financeiro/fechamento-fin-pdf')
  const blob = await pdf(<FechamentoFinPdfDoc dados={dados} mes={mes} ano={ano} MESES={MESES} />).toBlob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `fechamento-financeiro-${pad2(mes)}-${ano}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  dados: FechamentoFinanceiro[]
  mes: number
  ano: number
  secretarias: string[]
  MESES: string[]
  anos: number[]
  excluirAprendiz: boolean
  resumos: ResumoFechamento[]
  // KPI totals passados do server para o Excel de resumo
  kpis: {
    custoTotal: number; salarioTotal: number; ativos: number; afastados: number
    emFerias: number; diasFerias: number; custoFerias: number
  }
}

export function FechamentoFinClient({
  dados, mes, ano, secretarias, MESES, anos, excluirAprendiz, resumos, kpis,
}: Props) {
  const router = useRouter()

  const [loadingXlsx, setLoadingXlsx] = useState(false)
  const [loadingPdf,  setLoadingPdf]  = useState(false)
  const [salvando,    setSalvando]    = useState(false)
  const [salvoMsg,    setSalvoMsg]    = useState<{ ok: boolean; text: string } | null>(null)
  const [memoriaAberta, setMemoriaAberta] = useState<FechamentoFinanceiro | null>(null)

  // Filtros client-side
  const [filtroSecretaria, setFiltroSecretaria] = useState('')
  const [filtroRegime,     setFiltroRegime]     = useState('')
  const [agrupamento,      setAgrupamento]      = useState<AgrupKey>('secretaria')

  const secretariasParaFiltro = secretarias.filter(s => s.toUpperCase() !== 'AFASTADOS')
  const regimes = Array.from(new Set(dados.filter(d => !d.is_afastado).map(d => d.regime))).sort()

  const dadosFiltrados = dados
    .filter(d => !filtroSecretaria || (d.secretaria ?? 'Sem Secretaria') === filtroSecretaria)
    .filter(d => !filtroRegime || d.regime === filtroRegime)

  const grupos = computeGrupos(dadosFiltrados, agrupamento)

  async function handleSalvar() {
    setSalvando(true)
    setSalvoMsg(null)
    try {
      const result = await salvarResumoFechamento(mes, ano, excluirAprendiz)
      setSalvoMsg({ ok: result.ok, text: result.message })
      if (result.ok) router.refresh()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      {/* Gráfico de evolução */}
      <EvolucaoChart resumos={resumos} mesAtual={mes} anoAtual={ano} />

      {/* Controles */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Formulário de período */}
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
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 h-9 text-sm text-gray-700 select-none hover:bg-gray-50">
            <input
              type="checkbox"
              name="excluirAprendiz"
              value="1"
              defaultChecked={excluirAprendiz}
              className="h-4 w-4 rounded border-gray-300 accent-slate-800"
            />
            Excluir Jovem Aprendiz / Limpador de Vidros
          </label>
          <button type="submit" className="h-9 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700">
            Calcular
          </button>
        </form>

        {/* Ações */}
        <div className="ml-auto flex flex-wrap gap-2">
          {dados.length > 0 && (
            <button
              onClick={handleSalvar}
              disabled={salvando}
              className="flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {salvando ? 'Salvando…' : 'Salvar Fechamento'}
            </button>
          )}
          <button
            onClick={async () => {
              setLoadingXlsx(true)
              try {
                exportExcel(
                  dados, mes, ano, MESES,
                  kpis.ativos, kpis.custoTotal, kpis.salarioTotal,
                  kpis.emFerias, kpis.diasFerias, kpis.custoFerias,
                  kpis.afastados,
                )
              } finally { setLoadingXlsx(false) }
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

      {/* Feedback de salvamento */}
      {salvoMsg && (
        <div className={cn(
          'rounded-lg px-4 py-3 text-sm',
          salvoMsg.ok
            ? 'border border-green-200 bg-green-50 text-green-800'
            : 'border border-red-200 bg-red-50 text-red-800',
        )}>
          {salvoMsg.text}
        </div>
      )}

      {dados.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">
          Nenhum funcionário ativo no período.
        </div>
      ) : (
        <>
          {/* Filtros e agrupamento da tabela */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Secretaria */}
            {secretariasParaFiltro.length > 1 && (
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Secretaria</label>
                <select
                  value={filtroSecretaria}
                  onChange={e => setFiltroSecretaria(e.target.value)}
                  className={sel}
                >
                  <option value="">Todas</option>
                  {secretariasParaFiltro.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {/* Regime */}
            {regimes.length > 1 && (
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Regime</label>
                <select
                  value={filtroRegime}
                  onChange={e => setFiltroRegime(e.target.value)}
                  className={sel}
                >
                  <option value="">Todos</option>
                  {regimes.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}

            {/* Agrupamento */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Agrupar por</label>
              <div className="flex h-9 overflow-hidden rounded-lg border border-gray-200 bg-white text-sm">
                {(['secretaria', 'funcao', 'posto'] as const).map(k => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setAgrupamento(k)}
                    className={cn(
                      'px-3 text-sm transition-colors',
                      agrupamento === k
                        ? 'bg-slate-900 font-semibold text-white'
                        : 'text-gray-500 hover:bg-gray-50',
                    )}
                  >
                    {k === 'secretaria' ? 'Secretaria' : k === 'funcao' ? 'Função' : 'Posto'}
                  </button>
                ))}
              </div>
            </div>

            {/* Contagem filtrada */}
            {(filtroSecretaria || filtroRegime) && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {dadosFiltrados.filter(d => !d.is_afastado).length} funcionários filtrados
                </span>
                <button
                  onClick={() => { setFiltroSecretaria(''); setFiltroRegime('') }}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </div>

          {/* Tabela agrupada */}
          <div className="space-y-6">
            {grupos.map(({ label, items, isAfastados }) => {
              const totalSalario = isAfastados ? 0 : items.reduce((s, d) => s + d.salario_prop, 0)
              const totalCusto   = isAfastados ? 0 : items.reduce((s, d) => s + (d.custo_prop ?? 0), 0)

              return (
                <div key={label} className={cn(
                  'overflow-hidden rounded-xl border bg-white shadow-sm',
                  isAfastados ? 'border-gray-200 opacity-75' : 'border-gray-100',
                )}>
                  <div className={cn(
                    'flex items-center justify-between px-4 py-2',
                    isAfastados ? 'bg-gray-500' : 'bg-slate-800',
                  )}>
                    <span className="text-xs font-bold uppercase tracking-widest text-white">{label}</span>
                    <div className="flex items-center gap-4">
                      {isAfastados ? (
                        <span className="rounded bg-gray-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-200">
                          Custo não computado
                        </span>
                      ) : (
                        <>
                          <span className="text-xs text-slate-400">
                            Custo total: <span className="font-semibold text-slate-200">{fmtBRL(totalCusto)}</span>
                          </span>
                          <span className="text-xs text-slate-400">
                            Média/func.: <span className="font-semibold text-slate-200">{items.length > 0 ? fmtBRL(totalCusto / items.length) : '—'}</span>
                          </span>
                        </>
                      )}
                      <span className="text-xs text-slate-500">
                        {items.length} func.
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-slate-50">
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Funcionário</th>
                          {agrupamento !== 'funcao' && (
                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Função</th>
                          )}
                          {agrupamento !== 'posto' && (
                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Posto</th>
                          )}
                          {agrupamento === 'funcao' && (
                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Secretaria</th>
                          )}
                          <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-widest text-slate-500">Dias Trab./Úteis</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">Sal. Bruto (ref.)</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">Custo Total Prop.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {items.map(d => (
                          <tr
                            key={d.funcionario_id}
                            className={cn(
                              'hover:bg-slate-50',
                              d.em_ferias && !d.sem_custo && 'bg-orange-50 hover:bg-orange-100',
                              d.sem_custo && 'bg-amber-50 hover:bg-amber-100',
                            )}
                          >
                            <td className="px-4 py-2 font-medium text-gray-900">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link href={`/efetivo/${d.funcionario_id}`} className="hover:text-indigo-600 hover:underline">
                                  {d.funcionario_nome}
                                </Link>
                                {d.registro && <span className="text-xs text-gray-400">{d.registro}</span>}
                                {d.em_ferias && (
                                  <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700">
                                    Férias · {d.dias_ferias}d
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setMemoriaAberta(d)}
                                  className="inline-flex h-5 w-5 items-center justify-center rounded text-gray-300 transition-colors hover:bg-slate-100 hover:text-indigo-600"
                                  title="Ver memória de cálculo"
                                  aria-label={`Ver memória de cálculo de ${d.funcionario_nome}`}
                                >
                                  <Calculator className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                            {agrupamento !== 'funcao' && (
                              <td className="px-3 py-2 text-gray-600">{d.funcao ?? '—'}</td>
                            )}
                            {agrupamento !== 'posto' && (
                              <td className="px-3 py-2 text-gray-600">{d.posto_nome ?? '—'}</td>
                            )}
                            {agrupamento === 'funcao' && (
                              <td className="px-3 py-2 text-gray-600">{d.secretaria ?? '—'}</td>
                            )}
                            <td className="px-3 py-2 text-center tabular-nums text-gray-700">
                              {isAfastados ? '—' : `${d.dias_trabalhados}/${d.dias_uteis}`}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-400">
                              {d.salario_bruto > 0 ? fmtBRL(d.salario_bruto) : '—'}
                            </td>
                            <td className={cn(
                              'px-3 py-2 text-right tabular-nums font-medium',
                              isAfastados ? 'text-gray-400' : d.sem_custo ? 'text-amber-700' : 'text-indigo-700',
                            )}>
                              {isAfastados ? '—' : d.custo_prop != null ? fmtBRL(d.custo_prop) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 bg-slate-50 font-semibold">
                          <td className="px-4 py-2 text-gray-700" colSpan={agrupamento === 'funcao' ? 3 : 3}>
                            Total — {label}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                            {isAfastados ? '—' : fmtBRL(totalSalario)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-indigo-700">
                            {isAfastados ? '—' : fmtBRL(totalCusto)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {memoriaAberta && (
        <MemoriaCalculoDialog
          dados={memoriaAberta}
          mes={mes}
          ano={ano}
          MESES={MESES}
          onClose={() => setMemoriaAberta(null)}
        />
      )}
    </>
  )
}
