'use client'

import { useState } from 'react'
import { diasDaSemana } from '@/lib/agenda/datas'
import { PERIODOS, SLOTS_MAX, type Periodo } from '@/lib/agenda/tema'
import type { AgendaDados } from '@/app/(admin)/agenda/actions'
import { GradeSemanal } from './grade-semanal'
import { ModalBloco, type SlotAberto } from './modal-bloco'
import { ResumoSemana } from './resumo-semana'
import { Sugestoes } from './sugestoes'
import { Comentarios } from './comentarios'
import { CheckinPainel } from './checkin-painel'
import { AbaMapa } from './aba-mapa'
import { BotaoPdfSemana } from './botao-pdf'

export function AgendaSupervisor({
  dados,
  hoje,
  modoGestao,
}: {
  dados: AgendaDados
  hoje: string
  modoGestao: boolean
}) {
  const [slot, setSlot] = useState<SlotAberto | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [aba, setAba] = useState<'agenda' | 'mapa'>('agenda')
  const { semanaInicio, semana, blocos, tipos, postos, sugestoes, comentarios, podeEditar, ehDono, supervisor, checkinsHoje, geoDisponivel, feriados } = dados
  const dias = diasDaSemana(semanaInicio)
  const publicada = semana.status === 'publicada'

  function hrefSemana(s: string) {
    const q = new URLSearchParams()
    if (s) q.set('semana', s)
    if (modoGestao) q.set('supervisor', supervisor.id)
    const qs = q.toString()
    return qs ? `/agenda?${qs}` : '/agenda'
  }

  function agendarPosto(postoId: string) {
    setAviso(null)
    const ocupados = new Set(blocos.map(b => `${b.data}|${b.periodo}|${b.ordem}`))
    for (const data of dias) {
      if (data < hoje) continue
      if (feriados[data] && feriados[data].tipo !== 'facultativo') continue // feriado de lei: sem expediente
      for (const p of PERIODOS) {
        for (let ordem = 1; ordem <= SLOTS_MAX; ordem++) {
          if (!ocupados.has(`${data}|${p.id}|${ordem}`)) {
            setSlot({ data, periodo: p.id as Periodo, ordem, bloco: null, postoInicial: postoId })
            return
          }
        }
      }
    }
    setAviso('Não há horário livre nesta semana (a partir de hoje). Navegue para a próxima semana.')
  }

  return (
    <div className="space-y-5">
      <ResumoSemana
        supervisorId={supervisor.id}
        supervisorNome={supervisor.nome}
        semanaInicio={semanaInicio}
        status={semana.status}
        blocos={blocos}
        tipos={tipos}
        podeEditar={podeEditar}
        diasFeriado={dias.filter(d => feriados[d] && feriados[d].tipo !== 'facultativo').length}
        hrefSemana={hrefSemana}
        voltarHref={modoGestao ? `/agenda${semanaInicio ? `?semana=${semanaInicio}` : ''}` : undefined}
      />

      <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 sm:w-fit">
        {([
          { id: 'agenda', label: '🗓️ Agenda' },
          { id: 'mapa', label: '🗺️ Mapa de visitas' },
        ] as const).map(t => (
          <button
            key={t.id} type="button" onClick={() => setAba(t.id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
              aba === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
        <BotaoPdfSemana
          supervisorId={supervisor.id}
          supervisorNome={supervisor.nome}
          semanaInicio={semanaInicio}
          publicada={publicada}
          blocos={blocos}
        />
      </div>

      {aba === 'mapa' && <AbaMapa semanaInicio={semanaInicio} supervisorId={supervisor.id} dias={dias} />}

      {aba === 'agenda' && modoGestao && podeEditar && (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-900">
          ✏️ Você está editando em nome de <b>{supervisor.nome}</b>. Alterações ficam registradas na linha do tempo. Check-in e fotos continuam exclusivos do supervisor.
        </p>
      )}

      {aba === 'agenda' && ehDono && dias.includes(hoje) && (
        <CheckinPainel hoje={hoje} blocos={blocos} tipos={tipos} postos={postos} checkins={checkinsHoje} geoDisponivel={geoDisponivel} />
      )}

      {aba === 'agenda' && publicada && podeEditar && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          🔒 Agenda publicada. Qualquer alteração exige um motivo e fica registrada na linha do tempo.
        </p>
      )}
      {aba === 'agenda' && aviso && <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">{aviso}</p>}

      <div className={`grid gap-5 xl:grid-cols-[1fr_340px] ${aba === 'agenda' ? '' : 'hidden'}`}>
        <GradeSemanal
          dias={dias}
          blocos={blocos}
          tipos={tipos}
          hoje={hoje}
          podeEditar={podeEditar}
          feriados={feriados}
          onSlot={(data, periodo, ordem, bloco) => setSlot({ data, periodo, ordem, bloco })}
        />

        <div className="space-y-5">
          {podeEditar && <Sugestoes itens={sugestoes} onAgendar={agendarPosto} />}
          <Comentarios
            itens={comentarios}
            supervisorId={supervisor.id}
            semanaInicio={semanaInicio}
            temSemana={!!semana.id}
          />
        </div>
      </div>

      <ModalBloco
        slot={slot}
        semanaInicio={semanaInicio}
        supervisorId={supervisor.id}
        tipos={tipos.filter(t => t.ativo || slot?.bloco?.tipo_foco_id === t.id)}
        postos={postos}
        publicada={publicada}
        onClose={() => setSlot(null)}
      />
    </div>
  )
}
