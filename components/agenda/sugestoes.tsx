'use client'

import { Radar } from 'lucide-react'
import type { Sugestao } from '@/app/(admin)/agenda/actions'

export function Sugestoes({ itens, onAgendar }: { itens: Sugestao[]; onAgendar: (postoId: string) => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 border-t-4 border-t-rose-500 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Radar className="h-4 w-4 text-rose-500" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Radar de postos</h2>
        {itens.length > 0 && (
          <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">{itens.length}</span>
        )}
      </div>

      {itens.length === 0 ? (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          ✅ Todos os seus postos foram planejados nas últimas 2 semanas.
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs text-slate-400">Postos sem visita planejada há mais de 2 semanas.</p>
          <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {itens.map(s => {
              const nunca = s.dias === null
              const critico = nunca || (s.dias ?? 0) > 28
              return (
                <li key={s.posto_id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2">
                  <span className={`h-9 w-1 shrink-0 rounded-full ${critico ? 'bg-rose-500' : 'bg-amber-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{s.nome}</p>
                    <p className={`text-[11px] font-medium ${critico ? 'text-rose-600' : 'text-amber-600'}`}>
                      {nunca ? 'Nunca planejado' : `Última visita planejada há ${s.dias} dias`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAgendar(s.posto_id)}
                    className="shrink-0 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700"
                  >
                    + Agendar
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
