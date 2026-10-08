'use client'

import { useState } from 'react'
import { diasDaSemana } from '@/lib/agenda/datas'
import { PERIODOS, type Periodo } from '@/lib/agenda/tema'
import type { AgendaDados } from '@/app/(admin)/agenda/actions'
import { GradeSemanal } from './grade-semanal'
import { ModalBloco, type SlotAberto } from './modal-bloco'
import { ResumoSemana } from './resumo-semana'
import { Sugestoes } from './sugestoes'
import { Comentarios } from './comentarios'
import { CheckinPainel } from './checkin-painel'
import { AbaMapa } from './aba-mapa'

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
  const { semanaInicio, semana, blocos, tipos, postos, sugestoes, comentarios, podeEditar, supervisor, checkinsHoje, geoDisponivel } = dados
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
    const ocupados = new Set(blocos.map(b => `${b.data}|${b.periodo}`))
    for (const data of dias) {
      if (data < hoje) continue
      for (const p of PERIODOS) {
        if (!ocupados.has(`${data}|${p.id}`)) {
          setSlot({ data, periodo: p.id as Periodo, bloco: null, postoInicial: postoId })
          return
        }
      }
    }
    setAviso('Não há horário livre nesta semana (a partir de hoje). Navegue para a próxima semana.')
  }

  return (
    <div className="space-y-5">
      <ResumoSemana
        supervisorNome={supervisor.nome}
        semanaInicio={semanaInicio}
        status={semana.status}
        blocos={blocos}
        tipos={tipos}
        podeEditar={podeEditar}
        hrefSemana={hrefSemana}
        voltarHref={modoGestao ? `/agenda${semanaInicio ? `?semana=${semanaInicio}` : ''}` : undefined}
      />

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

      {aba === 'mapa' && <AbaMapa semanaInicio={semanaInicio} supervisorId={supervisor.id} dias={dias} />}

      {aba === 'agenda' && podeEditar && dias.includes(hoje) && (
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
          onSlot={(data, periodo, bloco) => setSlot({ data, periodo, bloco })}
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
        tipos={tipos.filter(t => t.ativo || slot?.bloco?.tipo_foco_id === t.id)}
        postos={postos}
        publicada={publicada}
        onClose={() => setSlot(null)}
      />
    </div>
  )
}
