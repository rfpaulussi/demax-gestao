'use client'

import { Fragment, useState, useTransition } from 'react'
import { RefreshCw, ChevronRight, ChevronDown, FileDown, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { exportToExcel, type ExcelColumn } from '@/lib/export-excel'
import { gerarSnapshot } from '@/app/(admin)/medicao/actions'

export type FuncionarioMedicao = {
  id:        string
  nome:      string
  registro:  string | null
}

export type MedicaoRow = {
  posto_id:         string
  posto_nome:       string
  secretaria:       string | null
  efetivo_previsto: number
  efetivo_real:     number
  diferenca:        number
  situacao:         'completo' | 'deficit' | 'excesso'
  funcionarios:     FuncionarioMedicao[]
}

const SITUACAO_BADGE: Record<
  MedicaoRow['situacao'],
  { label: string; className: string }
> = {
  completo: { label: 'Completo', className: 'bg-green-50 text-green-700 ring-green-200'    },
  deficit:  { label: 'Déficit',  className: 'bg-red-50 text-red-700 ring-red-200'          },
  excesso:  { label: 'Excesso',  className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
}

const ROW_BG: Record<MedicaoRow['situacao'], string> = {
  completo: 'hover:bg-gray-50',
  deficit:  'bg-red-50/50 hover:bg-red-50',
  excesso:  'bg-indigo-50/50 hover:bg-indigo-50',
}

const labelClass = 'text-xs font-semibold uppercase tracking-widest text-gray-400'
const selectClass =
  'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

// ─── Tipos para exportação Excel (linha achatada) ────────────────────────────

type ExcelFlatRow = {
  secretaria:       string
  posto_nome:       string
  efetivo_previsto: number
  efetivo_real:     number
  diferenca:        number
  situacao:         string
  registro:         string
  funcionario_nome: string
}

const EXCEL_COLS: ExcelColumn<ExcelFlatRow>[] = [
  { label: 'Secretaria',  value: r => r.secretaria },
  { label: 'Posto',       value: r => r.posto_nome },
  { label: 'Previsto',    value: r => r.efetivo_previsto },
  { label: 'Real',        value: r => r.efetivo_real },
  { label: 'Diferença',   value: r => r.diferenca },
  { label: 'Situação',    value: r => r.situacao },
  { label: 'RE',          value: r => r.registro, asText: true },
  { label: 'Funcionário', value: r => r.funcionario_nome },
]

function flattenForExcel(rows: MedicaoRow[]): ExcelFlatRow[] {
  const result: ExcelFlatRow[] = []
  for (const r of rows) {
    const base = {
      secretaria:       r.secretaria ?? '—',
      posto_nome:       r.posto_nome,
      efetivo_previsto: r.efetivo_previsto,
      efetivo_real:     r.efetivo_real,
      diferenca:        r.diferenca,
      situacao:         SITUACAO_BADGE[r.situacao].label,
    }
    if (r.funcionarios.length === 0) {
      result.push({ ...base, registro: '—', funcionario_nome: '—' })
    } else {
      for (const f of r.funcionarios) {
        result.push({ ...base, registro: f.registro ?? '—', funcionario_nome: f.nome })
      }
    }
  }
  return result
}

// ─── Botão Gerar Snapshot ────────────────────────────────────────────────────

function GerarSnapshotButton() {
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setErro(null)
          startTransition(async () => {
            const result = await gerarSnapshot()
            if (result?.error) setErro(result.error)
          })
        }}
        disabled={pending}
      >
        <RefreshCw className={cn('h-4 w-4', pending && 'animate-spin')} />
        {pending ? 'Gerando...' : 'Gerar Snapshot do Mês'}
      </Button>
      {erro && <p className="text-xs text-red-500">{erro}</p>}
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────

export function MedicaoTable({
  rows,
  secretarias,
  canSnapshot,
  mesLabel,
}: {
  rows:        MedicaoRow[]
  secretarias: string[]
  canSnapshot: boolean
  mesLabel:    string
}) {
  const [filterSecretaria, setFilterSecretaria] = useState('')
  const [filterSituacao, setFilterSituacao]     = useState('')
  const [expanded, setExpanded]                 = useState<Set<string>>(new Set())
  const [pendingPdf, setPendingPdf]             = useState(false)

  const filtered = rows.filter(r => {
    if (filterSecretaria && r.secretaria !== filterSecretaria) return false
    if (filterSituacao   && r.situacao   !== filterSituacao)   return false
    return true
  })

  const hasFilter = Boolean(filterSecretaria || filterSituacao)

  function toggleExpand(posto_id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(posto_id)) { next.delete(posto_id) } else { next.add(posto_id) }
      return next
    })
  }

  function handleExcel() {
    exportToExcel(
      flattenForExcel(filtered),
      EXCEL_COLS,
      `medicao-${mesLabel.replace(/\s+/g, '-').toLowerCase()}.xlsx`,
    )
  }

  async function handlePdf() {
    setPendingPdf(true)
    try {
      const { pdf }          = await import('@react-pdf/renderer')
      const { MedicaoPdfDoc } = await import('./medicao-pdf')
      const blob = await pdf(<MedicaoPdfDoc rows={filtered} mesLabel={mesLabel} />).toBlob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `medicao-${mesLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setPendingPdf(false)
    }
  }

  return (
    <>
      {/* Barra de filtros + ações */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className={labelClass}>Secretaria</label>
            <select
              value={filterSecretaria}
              onChange={e => setFilterSecretaria(e.target.value)}
              className={selectClass}
            >
              <option value="">Todas</option>
              {secretarias.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Situação</label>
            <select
              value={filterSituacao}
              onChange={e => setFilterSituacao(e.target.value)}
              className={selectClass}
            >
              <option value="">Todas</option>
              <option value="completo">Completo</option>
              <option value="deficit">Déficit</option>
              <option value="excesso">Excesso</option>
            </select>
          </div>

          {hasFilter && (
            <button
              onClick={() => { setFilterSecretaria(''); setFilterSituacao('') }}
              className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-400 hover:bg-gray-50"
            >
              Limpar
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <p className={labelClass}>
            {filtered.length} posto{filtered.length !== 1 ? 's' : ''}
          </p>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExcel}
            disabled={filtered.length === 0}
          >
            <FileDown className="h-4 w-4" />
            Excel
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handlePdf}
            disabled={filtered.length === 0 || pendingPdf}
            className="bg-amber-500 text-slate-900 hover:bg-amber-400 border-amber-500"
          >
            <FileText className={cn('h-4 w-4', pendingPdf && 'animate-pulse')} />
            {pendingPdf ? 'Gerando...' : 'PDF'}
          </Button>

          {canSnapshot && <GerarSnapshotButton />}
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">
            Nenhum posto encontrado com os filtros aplicados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="w-8 px-2 py-3" />
                  {['Posto', 'Secretaria', 'Previsto', 'Real', 'Diferença', 'Situação'].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(r => {
                  const badge     = SITUACAO_BADGE[r.situacao]
                  const diffLabel = r.diferenca > 0 ? `+${r.diferenca}` : String(r.diferenca)
                  const diffClass =
                    r.diferenca > 0 ? 'text-green-600 font-semibold' :
                    r.diferenca < 0 ? 'text-red-600 font-semibold'   : 'text-gray-400'
                  const isOpen    = expanded.has(r.posto_id)
                  const hasFuncs  = r.funcionarios.length > 0

                  return (
                    <Fragment key={r.posto_id}>
                      <tr
                        className={cn('transition-colors', ROW_BG[r.situacao], hasFuncs && 'cursor-pointer')}
                        onClick={() => hasFuncs && toggleExpand(r.posto_id)}
                      >
                        {/* Chevron */}
                        <td className="px-2 py-3 text-gray-400">
                          {hasFuncs
                            ? isOpen
                              ? <ChevronDown className="h-4 w-4" />
                              : <ChevronRight className="h-4 w-4" />
                            : null}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-gray-900">{r.posto_nome}</td>
                        <td className="px-4 py-3.5 text-gray-500">{r.secretaria ?? '—'}</td>
                        <td className="px-4 py-3.5 tabular-nums text-gray-500">{r.efetivo_previsto}</td>
                        <td className="px-4 py-3.5 tabular-nums text-gray-500">{r.efetivo_real}</td>
                        <td className={cn('px-4 py-3.5 tabular-nums', diffClass)}>{diffLabel}</td>
                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                              badge.className,
                            )}
                          >
                            {badge.label}
                          </span>
                        </td>
                      </tr>

                      {/* Sub-linhas dos funcionários */}
                      {isOpen && r.funcionarios.map(f => (
                        <tr key={f.id} className="bg-gray-50 border-t border-gray-100">
                          <td />
                          <td colSpan={2} className="px-4 py-2 pl-8 text-sm text-gray-700">
                            {f.nome}
                          </td>
                          <td colSpan={4} className="px-4 py-2 text-xs font-mono text-gray-400">
                            RE: {f.registro ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
