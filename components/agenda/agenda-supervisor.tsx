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
  const { semanaInicio, semana, blocos, tipos, postos, sugestoes, comentarios, podeEditar, supervisor } = dados
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

      {publicada && podeEditar && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          🔒 Agenda publicada. Qualquer alteração exige um motivo e fica registrada na linha do tempo.
        </p>
      )}
      {aviso && <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">{aviso}</p>}

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
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
