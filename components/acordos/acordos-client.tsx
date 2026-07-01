'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, FileText, Pencil, Trash2, Plus } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import type { AcordoCompensacao, AcordoPostoItem } from '@/app/(admin)/acordos/actions'
import { excluirAcordo, marcarEntregueRH, editarAcordo } from '@/app/(admin)/acordos/actions'
import { AcordoPdfDoc } from './acordo-pdf'
import { ModalNovoAcordo } from './modal-novo-acordo'

function fmtData(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
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
  const [titulo, setTitulo]     = useState(acordo.titulo)
  const [dataDoc, setDataDoc]   = useState(acordo.data_documento.split('T')[0])
  const [descricao, setDescricao] = useState(acordo.descricao_acordo)
  const [erro, setErro]         = useState('')
  const [pending, start]        = useTransition()

  function handleSalvar() {
    if (!titulo.trim()) { setErro('Informe o título.'); return }
    start(async () => {
      const res = await editarAcordo(acordo.id, {
        titulo: titulo.trim(),
        data_documento: dataDoc,
        descricao_acordo: descricao.trim(),
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
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
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
}

export function AcordosClient({ acordos, postos }: Props) {
  const router = useRouter()
  const [showModal, setShowModal]   = useState(false)
  const [editando, setEditando]     = useState<AcordoCompensacao | null>(null)
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null)
  const [deletando, setDeletando]   = useState<string | null>(null)
  const [entregando, setEntregando] = useState<string | null>(null)

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

  async function handleDelete(id: string) {
    if (!confirm('Excluir este acordo? Esta ação não pode ser desfeita.')) return
    setDeletando(id)
    await excluirAcordo(id)
    setDeletando(null)
    router.refresh()
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
      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {acordos.length} acordo{acordos.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700"
        >
          <Plus className="h-4 w-4" />
          Novo Acordo
        </button>
      </div>

      {/* List */}
      {acordos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <p className="text-sm text-gray-400">Nenhum acordo cadastrado.</p>
          <p className="mt-1 text-xs text-gray-300">Clique em &quot;Novo Acordo&quot; para criar o primeiro.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {/* Header */}
          <div className="border-b border-gray-100 bg-gray-50 px-5 py-2.5">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-center">
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Título</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Tipo</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Funcionários</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Data</span>
              <span />
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {acordos.map(a => (
              <div key={a.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-center px-5 py-3 hover:bg-gray-50/60">
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

                <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  a.tipo === 'individual'
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-purple-50 text-purple-700'
                }`}>
                  {a.tipo === 'individual' ? 'Individual' : 'Coletivo'}
                </span>

                <p className="text-sm text-gray-700">{a.funcionarios.length} func.</p>

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
                    onClick={() => handleDelete(a.id)}
                    disabled={deletando === a.id}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
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
    </>
  )
}
