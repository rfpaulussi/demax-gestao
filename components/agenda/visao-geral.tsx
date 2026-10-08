import Link from 'next/link'
import { ChevronLeft, ChevronRight, MessageCircle, RefreshCw } from 'lucide-react'
import { PERIODOS, TOTAL_SLOTS, temaDe } from '@/lib/agenda/tema'
import { addDias, diasDaSemana, rotuloSemana } from '@/lib/agenda/datas'
import type { CardSupervisor, TipoFoco } from '@/app/(admin)/agenda/actions'

const STATUS = {
  publicada:  { label: 'Publicada',  badge: 'bg-emerald-100 text-emerald-700', topo: 'border-t-emerald-500' },
  rascunho:   { label: 'Rascunho',   badge: 'bg-amber-100 text-amber-700',     topo: 'border-t-amber-400' },
  sem_agenda: { label: 'Sem agenda', badge: 'bg-rose-100 text-rose-700',       topo: 'border-t-rose-500' },
} as const

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}

export function VisaoGeral({
  semanaInicio,
  cards,
  tipos,
  ehAdmin,
}: {
  semanaInicio: string
  cards: CardSupervisor[]
  tipos: TipoFoco[]
  ehAdmin: boolean
}) {
  const dias = diasDaSemana(semanaInicio)
  const n = (s: CardSupervisor['status']) => cards.filter(c => c.status === s).length

  const kpis = [
    { label: 'Supervisores', valor: cards.length, topo: 'border-t-blue-500' },
    { label: 'Publicadas', valor: n('publicada'), topo: 'border-t-emerald-500' },
    { label: 'Em rascunho', valor: n('rascunho'), topo: 'border-t-amber-400' },
    { label: 'Sem agenda', valor: n('sem_agenda'), topo: 'border-t-rose-500' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agenda dos Supervisores</h1>
          <p className="text-sm text-slate-500">Planejamento semanal de visitas e focos de supervisão.</p>
        </div>
        <div className="flex items-center gap-2">
          {ehAdmin && (
            <Link href="/agenda/tipos" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              ⚙️ Tipos de foco
            </Link>
          )}
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-900 p-1 text-white">
            <Link href={`/agenda?semana=${addDias(semanaInicio, -7)}`} className="rounded-lg p-2 hover:bg-white/10" aria-label="Semana anterior"><ChevronLeft className="h-4 w-4" /></Link>
            <span className="min-w-36 text-center text-sm font-bold">{rotuloSemana(semanaInicio)}</span>
            <Link href={`/agenda?semana=${addDias(semanaInicio, 7)}`} className="rounded-lg p-2 hover:bg-white/10" aria-label="Próxima semana"><ChevronRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map(k => (
          <div key={k.label} className={`rounded-xl border border-slate-200 border-t-4 bg-white p-4 shadow-sm ${k.topo}`}>
            <p className="text-3xl font-black text-slate-900">{k.valor}</p>
            <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-slate-200">
        {tipos.filter(t => t.ativo).map(t => (
          <span key={t.id} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className={`h-2.5 w-2.5 rounded-sm ${temaDe(t.cor).dot}`} /> {t.icone} {t.nome}
          </span>
        ))}
      </div>

      {cards.length === 0 ? (
        <p className="rounded-xl bg-white p-8 text-center text-slate-400 shadow-sm ring-1 ring-slate-200">Nenhum supervisor ativo.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(c => {
            const st = STATUS[c.status]
            return (
              <Link
                key={c.id}
                href={`/agenda?supervisor=${c.id}&semana=${semanaInicio}`}
                className={`group rounded-2xl border border-slate-200 border-t-4 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${st.topo}`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-emerald-700 text-sm font-black text-white">
                    {iniciais(c.nome)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-900">{c.nome}</p>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${st.badge}`}>{st.label}</span>
                  </div>
                  <p className="text-right text-xl font-black text-slate-900">
                    {c.blocos}<span className="text-xs font-semibold text-slate-400">/{TOTAL_SLOTS}</span>
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-6 gap-1">
                  {dias.map(d => (
                    <div key={d} className="flex flex-col gap-1">
                      {PERIODOS.map(p => {
                        const cor = c.slots[`${d}|${p.id}`]
                        return (
                          <span
                            key={p.id}
                            title={cor ? undefined : 'Livre'}
                            className={`h-5 rounded-md ${cor ? temaDe(cor).dot : 'bg-slate-100'}`}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500">
                  <span><b className="text-slate-800">{c.postosDistintos}</b>/{c.totalPostos} postos planejados</span>
                  {c.replanejamentos > 0 && (
                    <span className="flex items-center gap-1 text-amber-600"><RefreshCw className="h-3 w-3" /> {c.replanejamentos}</span>
                  )}
                  {c.comentarios > 0 && (
                    <span className="flex items-center gap-1 text-indigo-600"><MessageCircle className="h-3 w-3" /> {c.comentarios}</span>
                  )}
                  <span className="ml-auto font-semibold text-slate-400 transition group-hover:text-slate-900">Abrir →</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
