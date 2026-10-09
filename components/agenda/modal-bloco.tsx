'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Search, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { PERIODOS, temaDe, type Periodo } from '@/lib/agenda/tema'
import { diaMes } from '@/lib/agenda/datas'
import { removerBloco, salvarBloco } from '@/app/(admin)/agenda/actions'
import type { BlocoView, PostoOpt, TipoFoco } from '@/app/(admin)/agenda/actions'

export type SlotAberto = {
  data: string
  periodo: Periodo
  ordem: number
  bloco: BlocoView | null
  postoInicial?: string
}

export function ModalBloco({
  slot,
  semanaInicio,
  supervisorId,
  tipos,
  postos,
  publicada,
  onClose,
}: {
  slot: SlotAberto | null
  semanaInicio: string
  supervisorId: string
  tipos: TipoFoco[]
  postos: PostoOpt[]
  publicada: boolean
  onClose: () => void
}) {
  return (
    <Dialog open={!!slot} onOpenChange={o => { if (!o) onClose() }}>
      {slot && (
        <Conteudo
          key={`${slot.data}|${slot.periodo}|${slot.ordem}|${slot.bloco?.id ?? 'novo'}`}
          slot={slot}
          semanaInicio={semanaInicio}
          supervisorId={supervisorId}
          tipos={tipos}
          postos={postos}
          publicada={publicada}
          onClose={onClose}
        />
      )}
    </Dialog>
  )
}

function Conteudo({
  slot, semanaInicio, supervisorId, tipos, postos, publicada, onClose,
}: {
  slot: SlotAberto
  semanaInicio: string
  supervisorId: string
  tipos: TipoFoco[]
  postos: PostoOpt[]
  publicada: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [tipoId, setTipoId] = useState(slot.bloco?.tipo_foco_id ?? '')
  const [sel, setSel] = useState<Set<string>>(
    new Set(slot.bloco ? slot.bloco.postos.map(p => p.id) : slot.postoInicial ? [slot.postoInicial] : []),
  )
  const [obs, setObs] = useState(slot.bloco?.observacao ?? '')
  const [motivo, setMotivo] = useState('')
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const periodo = PERIODOS.find(p => p.id === slot.periodo)!
  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return q ? postos.filter(p => p.nome.toLowerCase().includes(q) || (p.secretaria ?? '').toLowerCase().includes(q)) : postos
  }, [busca, postos])

  function alternar(id: string) {
    setSel(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function salvar() {
    setErro(null)
    if (!tipoId) return setErro('Escolha o tipo de foco')
    start(async () => {
      const r = await salvarBloco({
        semanaInicio, data: slot.data, periodo: slot.periodo, ordem: slot.ordem,
        tipoFocoId: tipoId, postoIds: Array.from(sel), observacao: obs, motivo, supervisorId,
      })
      if (!r.ok) return setErro(r.erro)
      router.refresh()
      onClose()
    })
  }

  function remover() {
    if (!slot.bloco) return
    setErro(null)
    start(async () => {
      const r = await removerBloco({ semanaInicio, blocoId: slot.bloco!.id, motivo, supervisorId })
      if (!r.ok) return setErro(r.erro)
      router.refresh()
      onClose()
    })
  }

  return (
    <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
      <div className={`h-1.5 w-full ${periodo.faixa}`} />
      <div className="flex max-h-[calc(92vh-6px)] flex-col overflow-y-auto">
        <DialogHeader className="px-5 pt-4">
          <DialogTitle className="text-lg font-black text-slate-900">
            {slot.bloco ? 'Editar visita' : 'Nova visita'} · {diaMes(slot.data)} · {periodo.label} · nº {slot.ordem}
          </DialogTitle>
          <DialogDescription>Escolha o foco da visita e os postos que serão atendidos.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 py-4">
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Tipo de foco</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {tipos.map(t => {
                const tema = temaDe(t.cor)
                const ativo = tipoId === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTipoId(t.id)}
                    className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs font-semibold transition ${tema.card} ${tema.texto} ${
                      ativo ? `ring-2 ring-offset-1 ${tema.ring} scale-[1.02] shadow-md` : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <span className="text-xl leading-none">{t.icone}</span>
                    <span className="leading-tight">{t.nome}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Postos</p>
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">{sel.size} selecionado(s)</span>
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar posto ou secretaria…"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-slate-400"
              />
            </div>
            <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-xl bg-slate-50 p-2">
              {visiveis.length === 0 && <p className="p-2 text-xs text-slate-400">Nenhum posto encontrado.</p>}
              {visiveis.map(p => {
                const ativo = sel.has(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => alternar(p.id)}
                    title={p.secretaria ?? undefined}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      ativo
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {p.nome}
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Observação</p>
            <textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="O que precisa ser visto/feito nessa visita? (opcional)"
              className="w-full resize-none rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-slate-400"
            />
          </section>

          {publicada && (
            <section className="rounded-xl border border-amber-300 bg-amber-50 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" /> Agenda publicada — replanejamento
              </p>
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                rows={2}
                placeholder="Informe o motivo da mudança (obrigatório)"
                className="w-full resize-none rounded-lg border border-amber-200 bg-white p-2.5 text-sm outline-none focus:border-amber-400"
              />
            </section>
          )}

          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{erro}</p>}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-slate-100 bg-white px-5 py-3">
          {slot.bloco ? (
            <button
              type="button"
              onClick={remover}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Remover
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={pending}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
            >
              {pending ? 'Salvando…' : 'Salvar bloco'}
            </button>
          </div>
        </div>
      </div>
    </DialogContent>
  )
}
