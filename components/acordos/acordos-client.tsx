'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, FileText, Pencil, Trash2, Plus } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import type { AcordoCompensacao, AcordoPostoItem } from '@/app/(admin)/acordos/actions'
import { excluirAcordo, marcarEntregueRH, editarAcordo } from '@/app/(admin)/acordos/actions'
import { AcordoPdfDoc } from './acordo-pdf'
import { ModalNovoAcordo } from './modal-novo-acordo'
import { ConfirmarExclusaoDialog } from '@/components/ui/confirmar-exclusao-dialog'

const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const sel = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

function fmtData(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

const SUBTIPO_BADGE: Record<string, { label: string; cls: string }> = {
  evento:      { label: 'Evento',      cls: 'bg-orange-50 text-orange-700' },
  antecipado:  { label: 'Antecipado',  cls: 'bg-indigo-50 text-indigo-700' },
}

// ─── Modal editar acordo ──────────────────────────────────────────────────────

function ModalEditarAcordo({
  acordo,
  onClose,
}: {
  acordo: AcordoCompensacao
  onClose: () => void
}) {
  const router = useRouter()
  const [titulo,   setTitulo]   = useState(acordo.titulo)
  const [dataDoc,  setDataDoc]  = useState(acordo.data_documento.split('T')[0])
  const [descricao,setDescricao]= useState(acordo.descricao_acordo)
  const [subtipo,  setSubtipo]  = useState<'evento' | 'antecipado' | ''>(acordo.subtipo ?? '')
  const [erro,     setErro]     = useState('')
  const [pending, start]        = useTransition()

  function handleSalvar() {
    if (!titulo.trim()) { setErro('Informe o título.'); return }
    start(async () => {
      const res = await editarAcordo(acordo.id, {
        titulo: titulo.trim(),
        data_documento: dataDoc,
        descricao_acordo: descricao.trim(),
        subtipo: subtipo || null,
      })
      if (res.error) { setErro(res.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="rounded-t-2xl bg-slate-900 px-6 py-4">
          <h2 className="text-base font-bold text-white">Editar Acordo</h2>
          <p className="mt-0.5 text-xs text-slate-400">Postos e funcionários são preservados</p>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Título</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Data do Documento</label>
              <input
                type="date"
                value={dataDoc}
                onChange={e => setDataDoc(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Tipo de Uso</label>
              <select
                value={subtipo}
                onChange={e => setSubtipo(e.target.value as 'evento' | 'antecipado' | '')}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="">Não classificado</option>
                <option value="evento">Evento (horas trabalhadas)</option>
                <option value="antecipado">Antecipado (banco de horas)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Texto do Acordo</label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={5}
              className="w-full resize-y rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={pending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {pending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

interface Props {
  acordos: AcordoCompensacao[]
  postos: AcordoPostoItem[]
  mes: number
  ano: number
  anos: number[]
}

export function AcordosClient({ acordos, postos, mes, ano, anos }: Props) {
  const router = useRouter()
  const [showModal, setShowModal]   = useState(false)
  const [editando, setEditando]     = useState<AcordoCompensacao | null>(null)
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null)
  const [excluindo, setExcluindo]   = useState<AcordoCompensacao | null>(null)
  const [entregando, setEntregando] = useState<string | null>(null)

  // Filtros client-side
  const [filtroCriador,   setFiltroCriador]   = useState('')
  const [filtroSubtipo,   setFiltroSubtipo]   = useState('')
  const [filtroSecretaria,setFiltroSecretaria] = useState('')

  const criadores = useMemo(
    () => Array.from(new Set(acordos.map(a => a.criado_por_nome).filter(Boolean))).sort() as string[],
    [acordos],
  )
  const secretarias = useMemo(
    () => Array.from(new Set(acordos.flatMap(a => a.postos.map(p => p.secretaria).filter(Boolean)))).sort() as string[],
    [acordos],
  )

  const filtrados = useMemo(() => acordos.filter(a =>
    (!filtroCriador    || a.criado_por_nome === filtroCriador) &&
    (!filtroSubtipo    || a.subtipo === filtroSubtipo) &&
    (!filtroSecretaria || a.postos.some(p => p.secretaria === filtroSecretaria)),
  ), [acordos, filtroCriador, filtroSubtipo, filtroSecretaria])

  // KPIs
  const totalFuncionarios = filtrados.reduce((s, a) => s + a.funcionarios.length, 0)
  const pendentesRH       = filtrados.filter(a => !a.entregue_rh).length
  const totalEvento       = filtrados.filter(a => a.subtipo === 'evento').length
  const totalAntecipado   = filtrados.filter(a => a.subtipo === 'antecipado').length

  async function handlePdf(acordo: AcordoCompensacao) {
    setLoadingPdf(acordo.id)
    try {
      const blob = await pdf(<AcordoPdfDoc acordo={acordo} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `acordo-compensacao-${acordo.titulo.toLowerCase().replace(/\s+/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoadingPdf(null)
    }
  }

  async function handleEntregueRH(id: string) {
    if (!confirm('Marcar como entregue no RH?')) return
    setEntregando(id)
    await marcarEntregueRH(id)
    setEntregando(null)
    router.refresh()
  }

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-t-4 border-slate-300 bg-white p-4 shadow-sm">
          <p className="text-3xl font-bold text-gray-900">{filtrados.length}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Acordos</p>
        </div>
        <div className="rounded-xl border border-t-4 border-blue-300 bg-white p-4 shadow-sm">
          <p className="text-3xl font-bold text-gray-900">{totalFuncionarios}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Funcionários</p>
        </div>
        <div className="rounded-xl border border-t-4 border-orange-400 bg-white p-4 shadow-sm">
          <p className="text-3xl font-bold text-gray-900">{totalEvento}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Eventos</p>
          {totalAntecipado > 0 && (
            <p className="text-xs text-indigo-600 mt-0.5">{totalAntecipado} antecipado{totalAntecipado !== 1 ? 's' : ''}</p>
          )}
        </div>
        <div className={`rounded-xl border border-t-4 ${pendentesRH > 0 ? 'border-red-400' : 'border-green-400'} bg-white p-4 shadow-sm`}>
          <p className={`text-3xl font-bold ${pendentesRH > 0 ? 'text-red-600' : 'text-gray-900'}`}>{pendentesRH}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Pendentes RH</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Mês/Ano — URL form */}
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Mês</label>
            <select name="mes" defaultValue={mes} className={sel}>
              {MESES.slice(1).map((m, i) => (
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
          <button type="submit" className="h-9 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700">
            Filtrar
          </button>
          <a href="/acordos" className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50">
            Limpar
          </a>
        </form>

        {/* Subtipo */}
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Tipo</label>
          <select value={filtroSubtipo} onChange={e => setFiltroSubtipo(e.target.value)} className={sel}>
            <option value="">Todos</option>
            <option value="evento">Evento</option>
            <option value="antecipado">Antecipado</option>
          </select>
        </div>

        {/* Criador */}
        {criadores.length > 1 && (
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Criado por</label>
            <select value={filtroCriador} onChange={e => setFiltroCriador(e.target.value)} className={sel}>
              <option value="">Todos</option>
              {criadores.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Secretaria */}
        {secretarias.length > 1 && (
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Secretaria</label>
            <select value={filtroSecretaria} onChange={e => setFiltroSecretaria(e.target.value)} className={sel}>
              <option value="">Todas</option>
              {secretarias.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <div className="ml-auto">
          <button
            onClick={() => setShowModal(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700"
          >
            <Plus className="h-4 w-4" />
            Novo Acordo
          </button>
        </div>
      </div>

      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        {filtrados.length} acordo{filtrados.length !== 1 ? 's' : ''} — {MESES[mes]} {ano}
      </p>

      {/* List */}
      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <p className="text-sm text-gray-400">Nenhum acordo encontrado para o período.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="min-w-[640px]">
          {/* Header */}
          <div className="border-b border-gray-100 bg-gray-50 px-5 py-2.5">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-3 items-center">
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Título</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Tipo/Uso</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Funcionários</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Criado por</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Data</span>
              <span />
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {filtrados.map(a => (
              <div key={a.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-3 items-center px-5 py-3 hover:bg-gray-50/60">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{a.titulo}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {a.postos.map(p => p.nome).join(' · ')}
                  </p>
                  {a.entregue_rh && (
                    <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="h-3 w-3" />
                      Entregue no RH{a.entregue_em ? ` em ${fmtData(a.entregue_em)}` : ''}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    a.tipo === 'individual' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                  }`}>
                    {a.tipo === 'individual' ? 'Individual' : 'Coletivo'}
                  </span>
                  {a.subtipo && (
                    <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${SUBTIPO_BADGE[a.subtipo].cls}`}>
                      {SUBTIPO_BADGE[a.subtipo].label}
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-700">{a.funcionarios.length} func.</p>

                <p className="text-xs text-gray-500">{a.criado_por_nome ?? '—'}</p>

                <p className="text-sm text-gray-600">{fmtData(a.data_documento)}</p>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handlePdf(a)}
                    disabled={loadingPdf === a.id}
                    className="flex h-8 items-center gap-1 rounded-lg bg-amber-500 px-2.5 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-40"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {loadingPdf === a.id ? '…' : 'PDF'}
                  </button>
                  {!a.entregue_rh && (
                    <button
                      onClick={() => handleEntregueRH(a.id)}
                      disabled={entregando === a.id}
                      title="Marcar como entregue no RH"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-green-50 hover:text-green-600 disabled:opacity-40"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setEditando(a)}
                    title="Editar"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-slate-50 hover:text-slate-700"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setExcluindo(a)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          </div>
        </div>
      )}

      {showModal && (
        <ModalNovoAcordo
          postos={postos}
          onClose={() => setShowModal(false)}
        />
      )}

      {editando && (
        <ModalEditarAcordo
          acordo={editando}
          onClose={() => setEditando(null)}
        />
      )}

      {excluindo && (
        <ConfirmarExclusaoDialog
          open
          onOpenChange={(open) => { if (!open) setExcluindo(null) }}
          titulo={`Excluir acordo "${excluindo.titulo}"?`}
          onConfirmar={async () => {
            const res = await excluirAcordo(excluindo.id)
            if (!res.error) router.refresh()
            return { success: !res.error, error: res.error }
          }}
        />
      )}
    </>
  )
}
