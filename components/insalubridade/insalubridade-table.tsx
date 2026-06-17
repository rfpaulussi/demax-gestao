'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, FileSpreadsheet, FileText } from 'lucide-react'
import * as XLSX from 'xlsx-js-style'
import { marcarEnviado, removerDia, editarCobertura, excluirCobertura } from '@/app/(admin)/insalubridade/actions'
import { ModalNovaInsalubridade } from './modal-nova-insalubridade'
import { downloadDeclaracaoPDF, downloadDeclaracaoPDFLote } from './declaracao-insalubridade-pdf'
import type { InsalubridadeGrupo, InsalubridadeCobertura, FuncOpt } from '@/app/(admin)/insalubridade/actions'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pendente: { label: 'Pendente', cls: 'bg-amber-50 text-amber-700 ring-amber-200'  },
  enviado:  { label: 'Enviado',  cls: 'bg-green-50 text-green-700 ring-green-200'  },
  pago:     { label: 'Pago',     cls: 'bg-blue-50 text-blue-700 ring-blue-200'     },
  misto:    { label: 'Misto',    cls: 'bg-gray-50 text-gray-600 ring-gray-200'     },
}

const ORIGEM_CHIP: Record<string, { label: string; cls: string }> = {
  manual:    { label: 'Manual',   cls: 'bg-slate-100 text-slate-600' },
  cobertura: { label: 'Cobertura', cls: 'bg-indigo-50 text-indigo-600' },
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function Badge({ status }: { status: string }) {
  const b = STATUS_BADGE[status] ?? STATUS_BADGE.pendente
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', b.cls)}>
      {b.label}
    </span>
  )
}

function RemoverBtn({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <button
      onClick={() => start(() => removerDia(id))}
      disabled={pending}
      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
    >
      {pending ? '...' : 'Remover'}
    </button>
  )
}

function MarcarEnviadoBtn({ grupo, mes, ano }: { grupo: InsalubridadeGrupo; mes: number; ano: number }) {
  const [pending, start] = useTransition()
  const temPendente = grupo.registros.some(r => r.status === 'pendente')
  if (!temPendente) return null
  return (
    <button
      onClick={() => start(() => marcarEnviado(grupo.funcionario_id, mes, ano))}
      disabled={pending}
      className="flex h-7 items-center rounded-md border border-green-200 bg-green-50 px-2.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
    >
      {pending ? '...' : 'Enviado'}
    </button>
  )
}

function PDFBtn({ grupo, mes, ano }: { grupo: InsalubridadeGrupo; mes: number; ano: number }) {
  const [loading, setLoading] = useState(false)
  return (
    <button
      onClick={async () => {
        setLoading(true)
        try { await downloadDeclaracaoPDF(grupo, mes, ano) }
        finally { setLoading(false) }
      }}
      disabled={loading}
      className="flex h-7 items-center rounded-md bg-amber-500 px-2.5 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
    >
      {loading ? '...' : 'PDF'}
    </button>
  )
}

// ─── Excel export ─────────────────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0') }

function exportExcelInsalubridade(grupos: InsalubridadeGrupo[], mes: number, ano: number) {
  const wb = XLSX.utils.book_new()
  const HEADERS = ['Funcionário','Função','Posto','Secretaria','Supervisor','Total Dias','Período (dias)','%','Status','Origens']
  const NC = HEADERS.length

  const rows: { data: (string | number)[]; style?: 'header' | 'totals' }[] = [
    { data: [`Insalubridade — ${pad2(mes)}/${ano}`] },
    { data: [] },
    { data: HEADERS, style: 'header' },
  ]

  for (const g of grupos) {
    rows.push({ data: [
      g.funcionario_nome,
      g.funcao ?? '—',
      g.posto_nome ?? '—',
      g.secretaria ?? '—',
      g.supervisor_nome ?? '—',
      g.total_dias,
      g.registros.reduce((s, r) => s + (r.periodo_dias ?? 1), 0),
      '40%',
      g.status.charAt(0).toUpperCase() + g.status.slice(1),
      g.origens.join(', '),
    ]})
  }

  rows.push({ data: [
    'TOTAL', '', '', '', '',
    grupos.reduce((s, g) => s + g.total_dias, 0),
    grupos.reduce((s, g) => s + g.registros.reduce((rs, r) => rs + (r.periodo_dias ?? 1), 0), 0),
    '', '', '',
  ], style: 'totals' })

  const aoa = rows.map(r => r.data)
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  rows.forEach((row, ri) => {
    if (!row.style) return
    for (let ci = 0; ci < NC; ci++) {
      const addr = XLSX.utils.encode_cell({ r: ri, c: ci })
      if (!ws[addr]) ws[addr] = { v: '', t: 's' }
      if (row.style === 'header') {
        ws[addr].s = {
          font: { bold: true, color: { rgb: '475569' } },
          fill: { patternType: 'solid', fgColor: { rgb: 'e2e8f0' } },
        }
      } else if (row.style === 'totals') {
        ws[addr].s = {
          font: { bold: true },
          fill: { patternType: 'solid', fgColor: { rgb: 'f1f5f9' } },
        }
      }
    }
  })

  ws['!cols'] = [{ wch: 36 }, { wch: 20 }, { wch: 32 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 6 }, { wch: 12 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Insalubridade')
  XLSX.writeFile(wb, `insalubridade-${pad2(mes)}-${ano}.xlsx`)
}

// ─── component ────────────────────────────────────────────────────────────────

interface Props {
  grupos: InsalubridadeGrupo[]
  mes: number
  ano: number
  funcionariosOpt: FuncOpt[]
  postos: { id: string; nome: string; secretaria: string | null }[]
  isAdmin: boolean
}

type EditForm = {
  data_cobertura: string
  periodo_dias: number
  agente_ausente_nome: string
  observacao: string
}

export function InsalubridadeTable({ grupos, mes, ano, funcionariosOpt, postos, isAdmin }: Props) {
  const router = useRouter()
  const [expanded, setExpanded]       = useState<Set<string>>(new Set())
  const [showModal, setShowModal]     = useState(false)
  const [loadingXlsx, setLoadingXlsx] = useState(false)
  const [loadingLote, setLoadingLote] = useState(false)
  const [editandoId, setEditandoId]   = useState<string | null>(null)
  const [editForm, setEditForm]       = useState<EditForm | null>(null)
  const [salvando, setSalvando]       = useState(false)

  function iniciarEdicao(r: InsalubridadeCobertura) {
    setEditandoId(r.id)
    setEditForm({
      data_cobertura:     r.data_cobertura.split('T')[0],
      periodo_dias:       r.periodo_dias ?? 1,
      agente_ausente_nome: r.agente_ausente_nome ?? '',
      observacao:         r.observacao ?? '',
    })
  }

  async function handleSalvar() {
    if (!editandoId || !editForm) return
    setSalvando(true)
    const result = await editarCobertura(editandoId, editForm)
    setSalvando(false)
    if (result.error) alert(result.error)
    else { setEditandoId(null); setEditForm(null); router.refresh() }
  }

  async function handleExcluir(id: string) {
    if (!window.confirm('Excluir esta cobertura? Esta ação não pode ser desfeita.')) return
    const result = await excluirCobertura(id)
    if (result.error) alert(result.error)
    else router.refresh()
  }

  async function handleExcel() {
    setLoadingXlsx(true)
    try { exportExcelInsalubridade(grupos, mes, ano) } finally { setLoadingXlsx(false) }
  }

  async function handlePDFLote() {
    setLoadingLote(true)
    try { await downloadDeclaracaoPDFLote(grupos, mes, ano) }
    finally { setLoadingLote(false) }
  }

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <>
      {/* Action buttons row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {grupos.length} funcionário{grupos.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExcel}
            disabled={loadingXlsx || grupos.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            {loadingXlsx ? 'Gerando…' : 'Excel'}
          </button>
          <button
            type="button"
            onClick={handlePDFLote}
            disabled={loadingLote || grupos.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-40"
          >
            <FileText className="h-4 w-4" />
            {loadingLote ? 'Gerando…' : 'PDF do Mês'}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            + Nova Declaração
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {grupos.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">
            Nenhum registro de insalubridade encontrado para este mês.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {grupos.map(grupo => {
              const isOpen = expanded.has(grupo.funcionario_id)
              return (
                <div key={grupo.funcionario_id}>
                  {/* Group header row */}
                  <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50/60">
                    <button
                      onClick={() => toggle(grupo.funcionario_id)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100"
                    >
                      {isOpen
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />
                      }
                    </button>

                    <div className="min-w-0 flex-1 grid grid-cols-[2fr_1.5fr_1fr_1fr_0.7fr_1fr_1fr] gap-2 items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{grupo.funcionario_nome}</p>
                        {grupo.funcao && <p className="truncate text-xs text-gray-400">{grupo.funcao}</p>}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-gray-700">{grupo.posto_nome ?? '—'}</p>
                        <p className="truncate text-xs text-gray-400">{grupo.secretaria ?? '—'}</p>
                      </div>
                      <p className="text-sm text-gray-600 truncate">{grupo.supervisor_nome ?? '—'}</p>
                      <p className="text-sm font-bold text-gray-900">{grupo.total_dias} dia{grupo.total_dias !== 1 ? 's' : ''}</p>
                      <p className="text-sm text-gray-600">40%</p>
                      <Badge status={grupo.status} />
                      <div className="flex flex-wrap gap-1">
                        {grupo.origens.map(o => {
                          const chip = ORIGEM_CHIP[o]
                          return (
                            <span key={o} className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', chip.cls)}>
                              {chip.label}
                            </span>
                          )
                        })}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <PDFBtn grupo={grupo} mes={mes} ano={ano} />
                      <MarcarEnviadoBtn grupo={grupo} mes={mes} ano={ano} />
                    </div>
                  </div>

                  {/* Expanded: days detail */}
                  {isOpen && (
                    <div className="border-t border-gray-50 bg-gray-50/50 px-12 py-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left">
                            {['Data', 'Período', 'Agente Ausente', 'Origem', 'Observação', ''].map(h => (
                              <th key={h} className="pb-2 pr-4 font-semibold uppercase tracking-widest text-gray-400">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {grupo.registros.map((r: InsalubridadeCobertura) => {
                            const chip = ORIGEM_CHIP[r.origem]
                            const isEditing = editandoId === r.id
                            return (
                              <>
                                <tr key={r.id} className="text-gray-600">
                                  <td className="py-1.5 pr-4 font-medium text-gray-800">{fmt(r.data_cobertura)}</td>
                                  <td className="py-1.5 pr-4">{r.periodo_dias ?? 1} dia{(r.periodo_dias ?? 1) !== 1 ? 's' : ''}</td>
                                  <td className="py-1.5 pr-4">{r.agente_ausente_nome ?? '—'}</td>
                                  <td className="py-1.5 pr-4">
                                    <span className={cn('inline-flex rounded-full px-2 py-0.5 font-medium', chip.cls)}>
                                      {chip.label}
                                    </span>
                                  </td>
                                  <td className="py-1.5 pr-4">{r.observacao ?? '—'}</td>
                                  <td className="py-1.5">
                                    <div className="flex items-center gap-2">
                                      {r.origem === 'manual' && !isAdmin && <RemoverBtn id={r.id} />}
                                      {isAdmin && (
                                        <>
                                          <button
                                            onClick={() => isEditing ? setEditandoId(null) : iniciarEdicao(r)}
                                            className="text-xs text-slate-600 hover:text-slate-900"
                                          >
                                            {isEditing ? 'Cancelar' : 'Editar'}
                                          </button>
                                          <button
                                            onClick={() => handleExcluir(r.id)}
                                            className="text-xs text-red-500 hover:text-red-700"
                                          >
                                            Excluir
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                                {isEditing && editForm && (
                                  <tr key={`edit-${r.id}`}>
                                    <td colSpan={6} className="pb-3 pt-1">
                                      <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                          <div>
                                            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Data</p>
                                            <input
                                              type="date"
                                              value={editForm.data_cobertura}
                                              onChange={e => setEditForm(f => f && ({ ...f, data_cobertura: e.target.value }))}
                                              className="flex h-8 w-full rounded-md border border-gray-200 px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                                            />
                                          </div>
                                          <div>
                                            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Período (dias)</p>
                                            <input
                                              type="number"
                                              min={1}
                                              value={editForm.periodo_dias}
                                              onChange={e => setEditForm(f => f && ({ ...f, periodo_dias: parseInt(e.target.value) || 1 }))}
                                              className="flex h-8 w-full rounded-md border border-gray-200 px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                                            />
                                          </div>
                                          <div>
                                            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Agente Ausente</p>
                                            <input
                                              type="text"
                                              value={editForm.agente_ausente_nome}
                                              onChange={e => setEditForm(f => f && ({ ...f, agente_ausente_nome: e.target.value }))}
                                              className="flex h-8 w-full rounded-md border border-gray-200 px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                                            />
                                          </div>
                                          <div>
                                            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Observação</p>
                                            <input
                                              type="text"
                                              value={editForm.observacao}
                                              onChange={e => setEditForm(f => f && ({ ...f, observacao: e.target.value }))}
                                              className="flex h-8 w-full rounded-md border border-gray-200 px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                                            />
                                          </div>
                                        </div>
                                        <div className="flex gap-2 pt-1">
                                          <button
                                            onClick={handleSalvar}
                                            disabled={salvando}
                                            className="flex h-7 items-center rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                                          >
                                            {salvando ? 'Salvando…' : 'Salvar'}
                                          </button>
                                          <button
                                            onClick={() => { setEditandoId(null); setEditForm(null) }}
                                            className="flex h-7 items-center rounded-md border border-gray-200 px-3 text-xs font-medium text-gray-500 hover:bg-gray-50"
                                          >
                                            Cancelar
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ModalNovaInsalubridade
        open={showModal}
        onClose={() => setShowModal(false)}
        funcionariosOpt={funcionariosOpt}
        postos={postos}
        mesAtual={mes}
        anoAtual={ano}
      />
    </>
  )
}
