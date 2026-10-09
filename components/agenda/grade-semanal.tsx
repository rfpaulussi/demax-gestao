'use client'

import { MessageSquareText, Plus, RefreshCw, Sun, Sunset } from 'lucide-react'
import { DIAS_CURTOS, PERIODOS, slotsVisiveis, temaDe, type FeriadoDia, type Periodo } from '@/lib/agenda/tema'
import { numeroDia } from '@/lib/agenda/datas'
import type { BlocoView, TipoFoco } from '@/app/(admin)/agenda/actions'

const ICONE_PERIODO = { manha: Sun, tarde: Sunset } as const

export function GradeSemanal({
  dias,
  blocos,
  tipos,
  hoje,
  podeEditar,
  feriados,
  onSlot,
}: {
  dias: string[]
  blocos: BlocoView[]
  tipos: TipoFoco[]
  hoje: string
  podeEditar: boolean
  feriados: Record<string, FeriadoDia>
  onSlot: (data: string, periodo: Periodo, ordem: number, bloco: BlocoView | null) => void
}) {
  const tiposMap = new Map(tipos.map(t => [t.id, t]))
  const porSlot = new Map(blocos.map(b => [`${b.data}|${b.periodo}|${b.ordem}`, b]))

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
      {dias.map((data, i) => {
        const ehHoje = data === hoje
        const passado = data < hoje
        const fer = feriados[data]
        const bloqueado = !!fer && fer.tipo !== 'facultativo'
        const temBlocos = blocos.some(b => b.data === data)
        const semPlanejar = bloqueado && !temBlocos
        return (
          <div
            key={data}
            className={`flex flex-col gap-2 rounded-2xl p-2 ${
              ehHoje ? 'bg-emerald-50 ring-2 ring-emerald-400/70' : bloqueado ? 'bg-rose-50/60 ring-1 ring-rose-200' : 'bg-white ring-1 ring-slate-200'
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

            {fer && (
              <p className={`rounded-lg px-2 py-1 text-[11px] font-semibold leading-tight ${
                bloqueado ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
              }`}>
                {bloqueado ? '🎉 Feriado' : '⚠️ Ponto facultativo'} · {fer.nome}
                {fer.ate_hora ? ` (até ${fer.ate_hora})` : ''}
              </p>
            )}

            {semPlanejar && (
              <div className="flex min-h-[120px] flex-1 items-center justify-center rounded-xl border-2 border-dashed border-rose-200 p-3 text-center text-xs font-medium text-rose-400">
                Sem expediente.<br />Não há visitas neste dia.
              </div>
            )}

            {(semPlanejar ? [] : PERIODOS).map(p => {
              const Icone = ICONE_PERIODO[p.id]
              const doPeriodo = blocos.filter(b => b.data === data && b.periodo === p.id)
              const maior = doPeriodo.reduce((m, b) => Math.max(m, b.ordem), 0)
              const total = slotsVisiveis(maior)
              return (
                <div key={p.id} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 px-1">
                    <span className={`h-1.5 w-4 rounded-full ${p.faixa}`} aria-hidden />
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <Icone className="h-3 w-3" /> {p.label}
                    </span>
                    <span className="ml-auto text-[10px] font-semibold text-slate-400">{doPeriodo.length}</span>
                  </div>

                  {Array.from({ length: total }, (_, k) => k + 1).map(ordem => {
                    const bloco = porSlot.get(`${data}|${p.id}|${ordem}`) ?? null
                    const tipo = bloco ? tiposMap.get(bloco.tipo_foco_id) : null

                    if (!bloco) {
                      return (
                        <button
                          key={ordem}
                          type="button"
                          disabled={!podeEditar || bloqueado}
                          onClick={() => onSlot(data, p.id, ordem, null)}
                          className="group flex min-h-[52px] w-full items-center justify-between rounded-xl border-2 border-dashed border-slate-200 px-2.5 py-1.5 text-left transition enabled:hover:border-slate-400 enabled:hover:bg-slate-50 disabled:cursor-default"
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">Visita {ordem}</span>
                          {podeEditar ? (
                            <Plus className="h-5 w-5 text-slate-300 transition group-hover:text-slate-600" />
                          ) : (
                            <span className="text-[10px] text-slate-300">livre</span>
                          )}
                        </button>
                      )
                    }

                    const tema = temaDe(tipo?.cor)
                    const extras = bloco.postos.length - 2
                    return (
                      <button
                        key={ordem}
                        type="button"
                        onClick={() => onSlot(data, p.id, ordem, bloco)}
                        className={`relative flex min-h-[52px] w-full flex-col gap-1 overflow-hidden rounded-xl border py-1.5 pl-3.5 pr-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tema.card} ${tema.texto}`}
                      >
                        <span className={`absolute inset-y-0 left-0 w-1.5 ${p.faixa}`} aria-hidden />
                        <span className="flex items-start gap-1.5 text-[12px] font-bold leading-tight">
                          <span className="text-sm leading-none">{tipo?.icone ?? '📌'}</span>
                          <span className="line-clamp-2 flex-1">{tipo?.nome ?? 'Foco'}</span>
                          {bloco.replanejado && <RefreshCw className="h-3 w-3 shrink-0 text-amber-600" aria-label="Replanejado" />}
                          {bloco.observacao && <MessageSquareText className="h-3 w-3 shrink-0" aria-label="Com observação" />}
                        </span>
                        <span className="flex flex-wrap gap-1">
                          {bloco.postos.slice(0, 2).map(po => (
                            <span key={po.id} className={`max-w-full truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium ${tema.chip}`}>
                              {po.nome}
                            </span>
                          ))}
                          {extras > 0 && <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${tema.chip}`}>+{extras}</span>}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
