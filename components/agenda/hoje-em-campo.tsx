'use client'

import Link from 'next/link'
import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { diaMes } from '@/lib/agenda/datas'
import { HORA_INICIO_ESPERADA, MIN_SEM_SAIDA_ALERTA } from '@/lib/agenda/hoje'
import type { DadosHoje, LinhaHoje, SituacaoHoje } from '@/app/(admin)/agenda/hoje-actions'

const INTERVALO_MS = 60_000

const SITUACAO: Record<SituacaoHoje, { rotulo: string; badge: string; prioridade: number }> = {
  sem_saida: { rotulo: 'Sem saída há muito tempo', badge: 'bg-rose-100 text-rose-700', prioridade: 0 },
  nao_comecou: { rotulo: 'Ainda não começou', badge: 'bg-rose-100 text-rose-700', prioridade: 1 },
  em_visita: { rotulo: 'Em visita agora', badge: 'bg-sky-100 text-sky-700', prioridade: 2 },
  em_campo: { rotulo: 'Em campo', badge: 'bg-emerald-100 text-emerald-700', prioridade: 3 },
  aguardando: { rotulo: 'Dia ainda não começou', badge: 'bg-slate-100 text-slate-600', prioridade: 4 },
  concluiu: { rotulo: 'Visitas concluídas', badge: 'bg-emerald-100 text-emerald-700', prioridade: 5 },
  apoio_sem_registro: { rotulo: 'Apoio: sem registro hoje', badge: 'bg-amber-100 text-amber-700', prioridade: 6 },
  sem_agenda: { rotulo: 'Sem agenda publicada', badge: 'bg-amber-100 text-amber-700', prioridade: 7 },
  livre: { rotulo: 'Sem visita planejada hoje', badge: 'bg-slate-100 text-slate-600', prioridade: 8 },
  feriado: { rotulo: 'Feriado', badge: 'bg-slate-100 text-slate-600', prioridade: 9 },
}

const hora = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))

const duracao = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`)

/** Quadro do dia. Atualiza sozinho a cada minuto. */
export function HojeEmCampo({ dados }: { dados: DadosHoje }) {
  const router = useRouter()

  useEffect(() => {
    const t = window.setInterval(() => router.refresh(), INTERVALO_MS)
    return () => window.clearInterval(t)
  }, [router])

  const linhas = useMemo(
    () => [...dados.linhas].sort((a, b) => SITUACAO[a.situacao].prioridade - SITUACAO[b.situacao].prioridade || a.nome.localeCompare(b.nome)),
    [dados.linhas],
  )
  const conta = (...s: SituacaoHoje[]) => dados.linhas.filter(l => s.includes(l.situacao)).length

  const kpis = [
    { label: 'Em campo agora', valor: conta('em_visita', 'sem_saida', 'em_campo'), topo: 'border-t-emerald-500' },
    { label: 'Ainda não começaram', valor: conta('nao_comecou'), topo: 'border-t-red-500' },
    { label: `Sem saída há +${MIN_SEM_SAIDA_ALERTA / 60} h`, valor: conta('sem_saida'), topo: 'border-t-orange-500' },
    { label: 'Concluíram', valor: conta('concluiu'), topo: 'border-t-blue-500' },
  ]

  const atualizado = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(dados.agora))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Agenda dos supervisores</p>
          <h1 className="text-2xl font-bold text-slate-900">Hoje em campo · {diaMes(dados.hoje)}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Quem já começou, quem não, e quem está há horas sem registrar a saída. Considera &quot;não começou&quot; quem tem visita planejada e nenhum check-in depois das {HORA_INICIO_ESPERADA}h.
          </p>
        </div>
        <button type="button" onClick={() => router.refresh()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Atualizado às {atualizado}
        </button>
      </div>

      {dados.feriado && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">🎉 Hoje é feriado: {dados.feriado}. Não há expediente previsto.</p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map(k => (
          <div key={k.label} className={`rounded-xl border border-slate-200 border-t-4 bg-white p-4 shadow-sm ${k.topo}`}>
            <p className="text-3xl font-black text-slate-900">{k.valor}</p>
            <p className="mt-1 text-[11px] uppercase tracking-widest text-slate-500">{k.label}</p>
          </div>
        ))}
      </div>

      <ul className="space-y-2">
        {linhas.map(l => <Linha key={l.id} l={l} />)}
        {linhas.length === 0 && <li className="rounded-xl bg-white p-8 text-center text-slate-400 shadow-sm ring-1 ring-slate-200">Nenhum supervisor ativo.</li>}
      </ul>
    </div>
  )
}

function Linha({ l }: { l: LinhaHoje }) {
  const st = SITUACAO[l.situacao]
  const alerta = l.situacao === 'sem_saida' || l.situacao === 'nao_comecou'
  return (
    <li>
      <Link href={`/agenda?supervisor=${l.id}`}
        className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border bg-white p-3.5 shadow-sm transition hover:shadow-md ${alerta ? 'border-rose-200' : 'border-slate-200'}`}>
        <div className="min-w-[10rem] flex-1">
          <p className="flex items-center gap-2 font-bold text-slate-900">
            {l.nome}
            {l.apoio && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-700">🧭 Apoio</span>}
          </p>
          <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${st.badge}`}>{st.rotulo}</span>
        </div>

        <div className="text-center">
          <p className="text-lg font-black text-slate-900">
            {l.apoio ? l.entradas : `${l.visitadas}/${l.planejadas}`}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-slate-400">{l.apoio ? 'postos visitados' : 'planejadas com check-in'}</p>
        </div>

        <div className="min-w-[12rem] flex-1 text-sm text-slate-600">
          {l.aberta ? (
            <p>
              <b className={l.situacao === 'sem_saida' ? 'text-rose-700' : 'text-sky-700'}>Em {l.aberta.posto}</b> desde {hora(l.aberta.desde)}
              <span className="text-slate-400"> ({duracao(l.aberta.minutos)})</span>
            </p>
          ) : l.ultima ? (
            <p>Último registro: {hora(l.ultima.em)} · {l.ultima.tipo === 'entrada' ? 'chegou em' : 'saiu de'} <b>{l.ultima.posto}</b></p>
          ) : (
            <p className="text-slate-400">Nenhum check-in hoje</p>
          )}
          {l.primeira && <p className="text-[11px] text-slate-400">Primeira chegada às {hora(l.primeira)}</p>}
        </div>
      </Link>
    </li>
  )
}
