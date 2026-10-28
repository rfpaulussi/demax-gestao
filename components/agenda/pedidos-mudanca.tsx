'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { decidirPedidoMudanca, type PedidoMudanca } from '@/app/(admin)/agenda/mudancas-actions'
import { rotuloSemana } from '@/lib/agenda/datas'

/** Pedidos dos supervisores para mudar a agenda publicada além do limite da semana. Admin e coordenador decidem. */
export function PedidosMudanca({ pedidos }: { pedidos: PedidoMudanca[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [resposta, setResposta] = useState<Record<string, string>>({})

  if (pedidos.length === 0) return null

  function decidir(p: PedidoMudanca, aprovar: boolean) {
    setErro(null)
    start(async () => {
      const r = await decidirPedidoMudanca({ pedidoId: p.id, aprovar, resposta: resposta[p.id] })
      if (!r.ok) return setErro(r.erro)
      router.refresh()
    })
  }

  return (
    <div className="rounded-2xl border border-indigo-200 border-t-4 border-t-indigo-500 bg-white p-4 shadow-sm">
      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-700">
        Pedidos de mudança de agenda
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px]">{pedidos.length}</span>
      </p>
      <p className="mb-3 text-xs text-slate-500">
        O supervisor já usou as mudanças da semana. Aprovar libera mais 1 mudança nessa semana.
      </p>
      {erro && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{erro}</p>}
      <ul className="space-y-2">
        {pedidos.map(p => (
          <li key={p.id} className="rounded-xl bg-slate-50 p-3">
            <p className="text-sm">
              <Link href={`/agenda?supervisor=${p.supervisorId}&semana=${p.semanaInicio}`} className="font-bold text-slate-900 hover:underline">
                {p.supervisorNome}
              </Link>
              <span className="text-xs text-slate-500"> · semana {rotuloSemana(p.semanaInicio)} · {p.usadas} mudanças usadas</span>
            </p>
            <p className="mt-1 text-sm text-slate-700">{p.motivo}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={resposta[p.id] ?? ''}
                onChange={e => setResposta(r => ({ ...r, [p.id]: e.target.value }))}
                placeholder="Resposta ao supervisor (opcional)"
                maxLength={300}
                className="min-w-48 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-slate-400"
              />
              <button type="button" disabled={pending} onClick={() => decidir(p, true)}
                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                <Check className="h-3.5 w-3.5" /> Aprovar
              </button>
              <button type="button" disabled={pending} onClick={() => decidir(p, false)}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50">
                <X className="h-3.5 w-3.5" /> Recusar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
