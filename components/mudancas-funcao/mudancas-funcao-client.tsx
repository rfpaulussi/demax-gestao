'use client'

import { useState, useMemo, useTransition } from 'react'
import { FileSpreadsheet, Pencil, Printer, Trash2 } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import { exportToExcel } from '@/lib/export-excel'
import { editarMudancaFuncao, excluirMudancaFuncao, toggleEnviadoRH } from '@/app/(admin)/mudancas-funcao/actions'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmarExclusaoDialog } from '@/components/ui/confirmar-exclusao-dialog'

export interface MudancaFuncaoAdminRow {
  id: string
  created_at: string
  funcionario_id: string
  solicitacao_id: string | null
  funcao_anterior_id: string | null
  funcao_nova_id: string | null
  nome: string
  registro: string | null
  posto: string
  secretaria: string
  funcao_anterior: string
  funcao_nova: string
  supervisor: string
  motivo: string | null
  tipo_solicitacao: string | null
  salario_anterior: number | null
  salario_nova: number | null
  escala: string | null
  insalubridade_anterior_perc: number | null
  insalubridade_nova_perc: number | null
  vt_anterior: number | null
  vt_nova: number | null
  vr_anterior: number | null
  vr_nova: number | null
  va_anterior: number | null
  va_nova: number | null
  premio_anterior: number | null
  premio_nova: number | null
  enviado_rh: boolean
}

const MESES_LABEL = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function fmtDt(iso: string): string {
  const [datePart, timePart] = iso.split('T')
  const [y, m, d] = datePart.split('-')
  const hm = timePart ? timePart.slice(0, 5) : ''
  return `${d}/${m}/${y}${hm ? ' ' + hm : ''}`
}

const sel = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

// ─── Modal Editar ─────────────────────────────────────────────────────────────

interface ModalEditarProps {
  row: MudancaFuncaoAdminRow
  funcoes: { id: string; nome: string }[]
  onClose: () => void
}

function ModalEditar({ row, funcoes, onClose }: ModalEditarProps) {
  const [funcaoId, setFuncaoId] = useState(row.funcao_nova_id ?? '')
  const [motivo,   setMotivo]   = useState(row.motivo ?? '')
  const [vigencia, setVigencia] = useState('')
  const [erro,     setErro]     = useState('')
  const [pending, startTransition] = useTransition()

  function handleSalvar() {
    if (!funcaoId) { setErro('Selecione uma função.'); return }
    const funcaoNome = funcoes.find(f => f.id === funcaoId)?.nome ?? ''
    const fd = new FormData()
    fd.set('movimentacao_id', row.id)
    if (row.solicitacao_id) fd.set('solicitacao_id', row.solicitacao_id)
    fd.set('funcao_id',      funcaoId)
    fd.set('funcao_nome',    funcaoNome)
    fd.set('motivo',         motivo)
    fd.set('vigencia',       vigencia)
    fd.set('funcionario_id', row.funcionario_id)
    startTransition(async () => {
      const res = await editarMudancaFuncao(fd)
      if (!res.success) { setErro(res.error); return }
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Mudança de Função</DialogTitle>
          <p className="text-sm text-gray-500">{row.nome}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Nova Função</label>
            <select
              value={funcaoId}
              onChange={e => setFuncaoId(e.target.value)}
              className={sel + ' w-full'}
            >
              <option value="">Selecionar...</option>
              {funcoes.map(f => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Motivo (opcional)</label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400 resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Data de Vigência</label>
            <input
              type="date"
              value={vigencia}
              onChange={e => setVigencia(e.target.value)}
              className={sel + ' w-full'}
            />
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={pending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {pending ? 'Salvando…' : 'Salvar'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Dialog Excluir ───────────────────────────────────────────────────────────

interface DialogExcluirProps {
  row: MudancaFuncaoAdminRow
  onClose: () => void
}

function DialogExcluir({ row, onClose }: DialogExcluirProps) {
  return (
    <ConfirmarExclusaoDialog
      open
      onOpenChange={(open) => { if (!open) onClose() }}
      titulo="Confirmar exclusão?"
      descricao={
        <>
          Esta ação irá reverter a função de <strong>{row.nome}</strong> para{' '}
          <strong>{row.funcao_anterior}</strong>. O registro de mudança será removido permanentemente.
        </>
      }
      onConfirmar={async () => {
        const fd = new FormData()
        fd.set('movimentacao_id', row.id)
        if (row.solicitacao_id)   fd.set('solicitacao_id', row.solicitacao_id)
        fd.set('funcionario_id',  row.funcionario_id)
        if (row.funcao_anterior_id) fd.set('funcao_anterior_id', row.funcao_anterior_id)
        const res = await excluirMudancaFuncao(fd)
        if (res.success) onClose()
        return res
      }}
    />
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  dados: MudancaFuncaoAdminRow[]
  mes: number
  ano: number
  anos: number[]
  funcoes: { id: string; nome: string }[]
}

export function MudancasFuncaoAdminClient({ dados, mes, ano, anos, funcoes }: Props) {
  const [supervisorFiltro, setSupervisorFiltro] = useState('')
  const [busca, setBusca]                       = useState('')
  const [editando, setEditando]                 = useState<MudancaFuncaoAdminRow | null>(null)
  const [excluindo, setExcluindo]               = useState<MudancaFuncaoAdminRow | null>(null)
  const [loadingPdfId, setLoadingPdfId]         = useState<string | null>(null)
  const [enviadoMap, setEnviadoMap]             = useState<Record<string, boolean>>(() =>
    Object.fromEntries(dados.map(r => [r.id, r.enviado_rh]))
  )

  async function handleToggleEnviado(r: MudancaFuncaoAdminRow) {
    const novoValor = !enviadoMap[r.id]
    setEnviadoMap(prev => ({ ...prev, [r.id]: novoValor }))
    const fd = new FormData()
    fd.set('movimentacao_id', r.id)
    fd.set('valor', String(novoValor))
    const res = await toggleEnviadoRH(fd)
    if (!res.success) {
      setEnviadoMap(prev => ({ ...prev, [r.id]: !novoValor }))
    }
  }

  async function handlePrintRow(r: MudancaFuncaoAdminRow) {
    setLoadingPdfId(r.id)
    try {
      const { MovimentacaoColaboradorDoc } = await import('@/components/relatorios/movimentacao-colaborador-pdf')
      const [y, m, d] = r.created_at.slice(0, 10).split('-')
      const vigencia = `${d}/${m}/${y}`
      const blob = await pdf(
        <MovimentacaoColaboradorDoc
          registro={r.registro}
          nome={r.nome}
          supervisor={r.supervisor}
          funcao_anterior={r.funcao_anterior}
          funcao_nova={r.funcao_nova}
          posto={r.posto}
          vigencia={vigencia}
          tipo_solicitacao={r.tipo_solicitacao}
          motivo={r.motivo}
          salario_anterior={r.salario_anterior}
          salario_nova={r.salario_nova}
          escala={r.escala}
          insalubridade_anterior_perc={r.insalubridade_anterior_perc}
          insalubridade_nova_perc={r.insalubridade_nova_perc}
          vt_anterior={r.vt_anterior}
          vt_nova={r.vt_nova}
          vr_anterior={r.vr_anterior}
          vr_nova={r.vr_nova}
          va_anterior={r.va_anterior}
          va_nova={r.va_nova}
          premio_anterior={r.premio_anterior}
          premio_nova={r.premio_nova}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `MUD_FUNCAO_${r.nome.replace(/\s+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoadingPdfId(null)
    }
  }

  const supervisores = useMemo(
    () => Array.from(new Set(dados.map(r => r.supervisor).filter(Boolean))).sort(),
    [dados],
  )

  const dadosFiltrados = useMemo(
    () => dados.filter(r =>
      (!supervisorFiltro || r.supervisor === supervisorFiltro) &&
      (!busca || r.nome.toLowerCase().includes(busca.toLowerCase())),
    ),
    [dados, supervisorFiltro, busca],
  )

  const totalMudancas     = dadosFiltrados.length
  const totalFuncionarios = new Set(dadosFiltrados.map(r => r.nome)).size

  function handleExport() {
    const pad2 = (n: number) => String(n).padStart(2, '0')
    exportToExcel(
      dadosFiltrados,
      [
        { label: 'Data',             value: r => fmtDt(r.created_at)  },
        { label: 'Registro',         value: r => r.registro ?? '—',   asText: true },
        { label: 'Nome',             value: r => r.nome               },
        { label: 'Função Anterior',  value: r => r.funcao_anterior    },
        { label: 'Nova Função',      value: r => r.funcao_nova        },
        { label: 'Posto',            value: r => r.posto              },
        { label: 'Secretaria',       value: r => r.secretaria         },
        { label: 'Supervisor',       value: r => r.supervisor         },
        { label: 'Motivo',           value: r => r.motivo ?? '—'      },
      ],
      `mudancas-funcao-${pad2(mes)}-${ano}.xlsx`,
    )
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-indigo-500 bg-white p-5 shadow-sm">
          <p className="text-4xl font-bold tracking-tight text-gray-900">{totalMudancas}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Mudanças no Período</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-slate-500 bg-white p-5 shadow-sm">
          <p className="text-4xl font-bold tracking-tight text-gray-900">{totalFuncionarios}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Funcionários Afetados</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Mês / Ano — via URL (form GET) */}
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Mês</label>
            <select name="mes" defaultValue={mes} className={sel}>
              {MESES_LABEL.slice(1).map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Ano</label>
            <select name="ano" defaultValue={ano} className={sel}>
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <button
            type="submit"
            className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700"
          >
            Filtrar
          </button>
          <a
            href="/mudancas-funcao"
            className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            Limpar
          </a>
        </form>

        {/* Supervisor — client-side */}
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Supervisor</label>
          <select
            value={supervisorFiltro}
            onChange={e => setSupervisorFiltro(e.target.value)}
            className={sel}
          >
            <option value="">Todos</option>
            {supervisores.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Busca por nome — client-side */}
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Buscar funcionário</label>
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Nome..."
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
          />
        </div>

        {/* Export */}
        <div className="ml-auto">
          <button
            type="button"
            onClick={handleExport}
            disabled={dadosFiltrados.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-40"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar Excel
          </button>
        </div>
      </div>

      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        {dadosFiltrados.length} registro{dadosFiltrados.length !== 1 ? 's' : ''}
        {(supervisorFiltro || busca) ? ` (filtrado de ${dados.length})` : ''}
      </p>

      {/* Tabela */}
      {dadosFiltrados.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm">
          <p className="text-sm text-gray-400">Nenhuma mudança de função encontrada para o período.</p>
        </div>
      ) : (
        <div className="w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-xs" style={{ minWidth: '820px' }}>
              <thead>
                <tr className="border-b border-gray-100 bg-slate-50">
                  {['Data', 'Colaborador', 'Função Anterior', 'Nova Função', 'Supervisor', 'Motivo', 'Env. RH', 'Ações'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dadosFiltrados.map(r => (
                  <tr key={r.id} className={`transition-colors hover:bg-gray-50/80 ${enviadoMap[r.id] ? 'bg-green-50/40' : ''}`}>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-400">{fmtDt(r.created_at)}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900 whitespace-nowrap">{r.nome}</p>
                      <p className="text-[10px] text-gray-400 whitespace-nowrap">{r.posto} · {r.secretaria}</p>
                      {r.registro && <p className="font-mono text-[10px] text-gray-300">{r.registro}</p>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-500">{r.funcao_anterior}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-indigo-600">{r.funcao_nova}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-500">{r.supervisor}</td>
                    <td className="max-w-xs truncate px-3 py-2 text-gray-400">{r.motivo ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleEnviado(r)}
                        title={enviadoMap[r.id] ? 'Enviado ao RH — clique para desmarcar' : 'Marcar como enviado ao RH'}
                        className={`inline-flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                          enviadoMap[r.id]
                            ? 'border-green-500 bg-green-500 text-white'
                            : 'border-gray-300 bg-white text-transparent hover:border-green-400'
                        }`}
                      >
                        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="1.5,6 4.5,9 10.5,3" />
                        </svg>
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handlePrintRow(r)}
                          disabled={loadingPdfId === r.id}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-40"
                          title="Imprimir PDF"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditando(r)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setExcluindo(r)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-700"
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {editando  && <ModalEditar   row={editando}  funcoes={funcoes} onClose={() => setEditando(null)}  />}
      {excluindo && <DialogExcluir row={excluindo}                   onClose={() => setExcluindo(null)} />}
    </div>
  )
}
