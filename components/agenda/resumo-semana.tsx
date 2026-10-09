'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Copy, Send } from 'lucide-react'
import { slotsDaSemana, temaDe } from '@/lib/agenda/tema'
import { addDias, rotuloSemana } from '@/lib/agenda/datas'
import { copiarSemanaAnterior, publicarSemana } from '@/app/(admin)/agenda/actions'
import type { BlocoView, TipoFoco } from '@/app/(admin)/agenda/actions'

function Anel({ pct }: { pct: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 80 80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke="#34d399" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-white">
        {Math.round(pct * 100)}%
      </span>
    </div>
  )
}

export function ResumoSemana({
  supervisorId,
  supervisorNome,
  semanaInicio,
  status,
  blocos,
  tipos,
  podeEditar,
  diasFeriado,
  hrefSemana,
  voltarHref,
}: {
  supervisorId: string
  supervisorNome: string
  semanaInicio: string
  status: 'rascunho' | 'publicada'
  blocos: BlocoView[]
  tipos: TipoFoco[]
  podeEditar: boolean
  diasFeriado: number // dias de feriado de lei na semana (reduzem a meta de visitas)
  hrefSemana: (semana: string) => string
  voltarHref?: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const contagem = tipos
    .map(t => ({ tipo: t, n: blocos.filter(b => b.tipo_foco_id === t.id).length }))
    .filter(x => x.n > 0)
  const postosDistintos = new Set(blocos.flatMap(b => b.postos.map(p => p.id))).size
  const replan = blocos.filter(b => b.replanejado).length
  const publicada = status === 'publicada'

  function rodar(fn: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro(null)
    start(async () => {
      const r = await fn()
      if (!r.ok) return setErro(r.erro ?? 'Erro')
      router.refresh()
    })
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-5 text-white shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {voltarHref && (
            <Link href={voltarHref} className="rounded-lg bg-white/10 p-2 transition hover:bg-white/20" aria-label="Voltar à visão geral">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300">Agenda de {supervisorNome}</p>
            <h1 className="text-2xl font-black leading-tight">{rotuloSemana(semanaInicio)}</h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Link href={hrefSemana(addDias(semanaInicio, -7))} className="rounded-lg bg-white/10 p-2 transition hover:bg-white/20" aria-label="Semana anterior">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link href={hrefSemana('')} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold transition hover:bg-white/20">
            Hoje
          </Link>
          <Link href={hrefSemana(addDias(semanaInicio, 7))} className="rounded-lg bg-white/10 p-2 transition hover:bg-white/20" aria-label="Próxima semana">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-5">
        <Anel pct={Math.min(1, blocos.length / Math.max(1, slotsDaSemana(diasFeriado)))} />

        <div className="grid grid-cols-3 gap-4 text-center">
          <div><p className="text-2xl font-black">{blocos.length}<span className="text-sm text-white/50">/{slotsDaSemana(diasFeriado)}</span></p><p className="text-[10px] uppercase tracking-widest text-white/60">Blocos</p></div>
          <div><p className="text-2xl font-black">{postosDistintos}</p><p className="text-[10px] uppercase tracking-widest text-white/60">Postos</p></div>
          <div><p className={`text-2xl font-black ${replan ? 'text-amber-300' : ''}`}>{replan}</p><p className="text-[10px] uppercase tracking-widest text-white/60">Replanej.</p></div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${
            publicada ? 'bg-emerald-400/20 text-emerald-300' : 'bg-amber-400/20 text-amber-300'
          }`}>
            {publicada ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-amber-300" />}
            {publicada ? 'Publicada' : 'Rascunho'}
          </span>
          {podeEditar && !publicada && (
            <>
              {blocos.length === 0 && (
                <button
                  type="button" disabled={pending}
                  onClick={() => rodar(() => copiarSemanaAnterior(semanaInicio, supervisorId))}
                  className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold transition hover:bg-white/20 disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar semana anterior
                </button>
              )}
              <button
                type="button" disabled={pending || blocos.length === 0}
                onClick={() => rodar(() => publicarSemana(semanaInicio, supervisorId))}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-400 px-4 py-2 text-xs font-bold text-slate-900 transition hover:bg-emerald-300 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" /> {pending ? 'Aguarde…' : 'Publicar agenda'}
              </button>
            </>
          )}
        </div>
      </div>

      {contagem.length > 0 && (
        <div className="mt-4">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-white/10">
            {contagem.map(({ tipo, n }) => (
              <div key={tipo.id} className={`${temaDe(tipo.cor).dot} transition-all`} style={{ width: `${(n / blocos.length) * 100}%` }} title={`${tipo.nome}: ${n}`} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {contagem.map(({ tipo, n }) => (
              <span key={tipo.id} className="flex items-center gap-1.5 text-[11px] text-white/80">
                <span className={`h-2 w-2 rounded-full ${temaDe(tipo.cor).dot}`} />
                {tipo.icone} {tipo.nome} <b className="text-white">{n}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      {erro && <p className="mt-3 rounded-lg bg-red-500/20 px-3 py-2 text-sm font-medium text-red-200">{erro}</p>}
    </div>
  )
}
