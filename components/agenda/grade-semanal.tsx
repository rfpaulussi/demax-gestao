'use client'

import { MessageSquareText, Plus, RefreshCw, Moon, Sun, Sunset } from 'lucide-react'
import { DIAS_CURTOS, PERIODOS, temaDe, type Periodo } from '@/lib/agenda/tema'
import { numeroDia } from '@/lib/agenda/datas'
import type { BlocoView, TipoFoco } from '@/app/(admin)/agenda/actions'

const ICONE_PERIODO = { manha: Sun, tarde: Sunset, noite: Moon } as const

export function GradeSemanal({
  dias,
  blocos,
  tipos,
  hoje,
  podeEditar,
  onSlot,
}: {
  dias: string[]
  blocos: BlocoView[]
  tipos: TipoFoco[]
  hoje: string
  podeEditar: boolean
  onSlot: (data: string, periodo: Periodo, bloco: BlocoView | null) => void
}) {
  const tiposMap = new Map(tipos.map(t => [t.id, t]))
  const porSlot = new Map(blocos.map(b => [`${b.data}|${b.periodo}`, b]))

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
      {dias.map((data, i) => {
        const ehHoje = data === hoje
        const passado = data < hoje
        return (
          <div
            key={data}
            className={`flex flex-col gap-2 rounded-2xl p-2 ${
              ehHoje ? 'bg-emerald-50 ring-2 ring-emerald-400/70' : 'bg-white ring-1 ring-slate-200'
            } shadow-sm`}
          >
            <div className="flex items-center justify-between px-1.5 pt-1 md:flex-col md:items-start md:gap-0.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{DIAS_CURTOS[i]}</span>
              <span className="flex items-center gap-1.5">
                <span className={`text-2xl font-black leading-none ${ehHoje ? 'text-emerald-600' : passado ? 'text-slate-400' : 'text-slate-900'}`}>
                  {numeroDia(data)}
                </span>
                {ehHoje && (
                  <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">hoje</span>
                )}
              </span>
            </div>

            {PERIODOS.map(p => {
              const bloco = porSlot.get(`${data}|${p.id}`) ?? null
              const tipo = bloco ? tiposMap.get(bloco.tipo_foco_id) : null
              const Icone = ICONE_PERIODO[p.id]

              if (!bloco) {
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!podeEditar}
                    onClick={() => onSlot(data, p.id, null)}
                    className="group flex min-h-[104px] flex-col justify-between rounded-xl border-2 border-dashed border-slate-200 p-2 text-left transition enabled:hover:border-slate-400 enabled:hover:bg-slate-50 disabled:cursor-default"
                  >
                    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      <Icone className="h-3 w-3" /> {p.label}
                    </span>
                    {podeEditar ? (
                      <span className="flex items-center justify-center text-slate-300 transition group-hover:text-slate-600">
                        <Plus className="h-6 w-6" />
                      </span>
                    ) : (
                      <span className="text-center text-xs text-slate-300">livre</span>
                    )}
                  </button>
                )
              }

              const tema = temaDe(tipo?.cor)
              const extras = bloco.postos.length - 2
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSlot(data, p.id, bloco)}
                  className={`relative flex min-h-[104px] flex-col gap-1.5 overflow-hidden rounded-xl border p-2 pl-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tema.card} ${tema.texto}`}
                >
                  <span className={`absolute inset-y-0 left-0 w-1.5 ${p.faixa}`} aria-hidden />
                  <span className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider opacity-70">
                    <span className="flex items-center gap-1"><Icone className="h-3 w-3" /> {p.label}</span>
                    <span className="flex items-center gap-1">
                      {bloco.replanejado && <RefreshCw className="h-3 w-3 text-amber-600" aria-label="Replanejado" />}
                      {bloco.observacao && <MessageSquareText className="h-3 w-3" aria-label="Com observação" />}
                    </span>
                  </span>
                  <span className="flex items-start gap-1.5 text-[13px] font-bold leading-tight">
                    <span className="text-base leading-none">{tipo?.icone ?? '📌'}</span>
                    <span className="line-clamp-2">{tipo?.nome ?? 'Foco'}</span>
                  </span>
                  <span className="mt-auto flex flex-wrap gap-1">
                    {bloco.postos.slice(0, 2).map(po => (
                      <span key={po.id} className={`max-w-full truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium ${tema.chip}`}>
                        {po.nome}
                      </span>
                    ))}
                    {extras > 0 && (
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${tema.chip}`}>+{extras}</span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
