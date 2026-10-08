'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CORES_FOCO, TEMAS, temaDe } from '@/lib/agenda/tema'
import { alternarTipoFoco, salvarTipoFoco } from '@/app/(admin)/agenda/actions'
import type { TipoFoco } from '@/app/(admin)/agenda/actions'

type Form = { id?: string; nome: string; cor: string; icone: string; ordem: number }
const VAZIO: Form = { nome: '', cor: 'blue', icone: '📌', ordem: 0 }

export function TiposFocoAdmin({ tipos }: { tipos: TipoFoco[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [form, setForm] = useState<Form>({ ...VAZIO, ordem: tipos.length + 1 })
  const [erro, setErro] = useState<string | null>(null)

  function salvar() {
    setErro(null)
    start(async () => {
      const r = await salvarTipoFoco(form)
      if (!r.ok) return setErro(r.erro)
      setForm({ ...VAZIO, ordem: tipos.length + 2 })
      router.refresh()
    })
  }

  function alternar(t: TipoFoco) {
    start(async () => {
      const r = await alternarTipoFoco(t.id, !t.ativo)
      if (!r.ok) setErro(r.erro)
      router.refresh()
    })
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <ul className="space-y-2">
        {tipos.map(t => {
          const tema = temaDe(t.cor)
          return (
            <li key={t.id} className={`flex items-center gap-3 rounded-xl border p-3 ${tema.card} ${tema.texto} ${t.ativo ? '' : 'opacity-50'}`}>
              <span className="text-2xl">{t.icone}</span>
              <div className="flex-1">
                <p className="font-bold">{t.nome}</p>
                <p className="text-[11px] opacity-70">ordem {t.ordem} · {t.ativo ? 'ativo' : 'desativado'}</p>
              </div>
              <button type="button" onClick={() => setForm({ id: t.id, nome: t.nome, cor: t.cor, icone: t.icone, ordem: t.ordem })}
                className="rounded-lg bg-white/70 px-3 py-1.5 text-xs font-semibold hover:bg-white">Editar</button>
              <button type="button" disabled={pending} onClick={() => alternar(t)}
                className="rounded-lg bg-white/70 px-3 py-1.5 text-xs font-semibold hover:bg-white disabled:opacity-50">
                {t.ativo ? 'Desativar' : 'Ativar'}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="h-fit rounded-2xl border border-slate-200 border-t-4 border-t-slate-900 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">{form.id ? 'Editar tipo' : 'Novo tipo de foco'}</h2>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input value={form.icone} onChange={e => setForm({ ...form, icone: e.target.value })} maxLength={8}
              className="w-16 rounded-lg border border-slate-200 p-2 text-center text-xl outline-none focus:border-slate-400" aria-label="Emoji" />
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Nome do foco"
              className="flex-1 rounded-lg border border-slate-200 p-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500">Cor</p>
            <div className="flex flex-wrap gap-2">
              {CORES_FOCO.map(c => (
                <button key={c} type="button" onClick={() => setForm({ ...form, cor: c })} aria-label={c}
                  className={`h-8 w-8 rounded-full ${TEMAS[c].dot} ${form.cor === c ? 'ring-2 ring-offset-2 ring-slate-900' : ''}`} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500">Ordem</p>
            <input type="number" value={form.ordem} onChange={e => setForm({ ...form, ordem: Number(e.target.value) })}
              className="w-24 rounded-lg border border-slate-200 p-2 text-sm outline-none focus:border-slate-400" />
          </div>
          {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={salvar}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
              {pending ? 'Salvando…' : 'Salvar'}
            </button>
            {form.id && (
              <button type="button" onClick={() => setForm({ ...VAZIO, ordem: tipos.length + 1 })}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancelar</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
