'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { CamposAcordo, TemplateId } from '@/lib/acordos/tipos'
import { fmtDataBR, hhmmParaMin } from '@/lib/acordos/tempo'
import type { MapaFeriados } from '@/lib/acordos/validar'

export interface FormState {
  dataEvento: string
  nomeEvento: string
  periodoInicio: string
  periodoFim: string
  duracao: string          // 'HH:MM' — usado quando não há período
  horaNormal: string
  horaDispensa: string
  motivo: string
  dataFolga: string
  datasAjuste: string[]
  prazoLimite: string
}

export const FORM_VAZIO: FormState = {
  dataEvento: '', nomeEvento: '', periodoInicio: '', periodoFim: '', duracao: '',
  horaNormal: '', horaDispensa: '', motivo: '', dataFolga: '', datasAjuste: [], prazoLimite: '',
}

export function montarCampos(template: TemplateId, f: FormState): CamposAcordo {
  const doPeriodo = f.periodoInicio && f.periodoFim ? hhmmParaMin(f.periodoFim) - hhmmParaMin(f.periodoInicio) : 0
  const daDuracao = f.duracao ? hhmmParaMin(f.duracao) : 0
  return {
    template,
    dataEvento: f.dataEvento || undefined,
    nomeEvento: f.nomeEvento || undefined,
    periodoInicio: f.periodoInicio || undefined,
    periodoFim: f.periodoFim || undefined,
    minutosOrigem: doPeriodo > 0 ? doPeriodo : daDuracao,
    horaNormal: f.horaNormal || undefined,
    horaDispensa: f.horaDispensa || undefined,
    motivo: f.motivo || undefined,
    dataFolga: f.dataFolga || undefined,
    datasAjuste: f.datasAjuste,
    prazoLimite: f.prazoLimite || undefined,
  }
}

const input = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300'
const label = 'mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500'

function Campo({ titulo, dica, children }: { titulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={label}>{titulo}</label>
      {children}
      {dica && <p className="mt-1 text-xs text-gray-400">{dica}</p>}
    </div>
  )
}

function ListaDatas({ datas, onChange }: { datas: string[]; onChange: (d: string[]) => void }) {
  const [nova, setNova] = useState('')
  function adicionar() {
    if (!nova || datas.includes(nova)) return
    onChange([...datas, nova].sort())
    setNova('')
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input type="date" value={nova} onChange={e => setNova(e.target.value)} className={input} />
        <button
          type="button"
          onClick={adicionar}
          className="flex h-10 shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </button>
      </div>
      {datas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {datas.map(d => (
            <span key={d} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {fmtDataBR(d)}
              <button type="button" onClick={() => onChange(datas.filter(x => x !== d))} aria-label={`Remover ${fmtDataBR(d)}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  template: TemplateId
  f: FormState
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  feriados: MapaFeriados
  onSugerirDias: (() => void) | null
}

export function CamposTemplate({ template: t, f, set, feriados, onSugerirDias }: Props) {
  const usaEvento = t === 'T1' || t === 'T2' || t === 'T5'
  const usaPeriodo = t === 'T1' || t === 'T5'
  const usaFolga = t === 'T3' || t === 'T4' || t === 'T5'
  const usaMotivo = t === 'T2' || t === 'T3' || t === 'T4'
  const usaAjuste = t !== 'T5'
  const rotuloAjuste = t === 'T1' ? 'Dias de redução da jornada' : 'Dias de acréscimo da jornada'
  const dica = feriados.get(f.dataFolga || f.dataEvento)

  return (
    <div className="space-y-4">
      {usaEvento && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo titulo="Data do evento">
            <input type="date" value={f.dataEvento} onChange={e => set('dataEvento', e.target.value)} className={input} />
          </Campo>
          <Campo titulo="Nome do evento">
            <input value={f.nomeEvento} onChange={e => set('nomeEvento', e.target.value)} placeholder="ex: Festa Junina" className={input} />
          </Campo>
        </div>
      )}

      {usaPeriodo && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo titulo="Das (opcional)">
            <input type="time" value={f.periodoInicio} onChange={e => set('periodoInicio', e.target.value)} className={input} />
          </Campo>
          <Campo titulo="Às (opcional)">
            <input type="time" value={f.periodoFim} onChange={e => set('periodoFim', e.target.value)} className={input} />
          </Campo>
          <Campo titulo="Horas trabalhadas" dica="Usado quando não há período.">
            <input type="time" value={f.duracao} onChange={e => set('duracao', e.target.value)} className={input} />
          </Campo>
        </div>
      )}

      {t === 'T2' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo titulo="Horário normal de saída">
            <input type="time" value={f.horaNormal} onChange={e => set('horaNormal', e.target.value)} className={input} />
          </Campo>
          <Campo titulo="Horário de dispensa">
            <input type="time" value={f.horaDispensa} onChange={e => set('horaDispensa', e.target.value)} className={input} />
          </Campo>
        </div>
      )}

      {usaFolga && (
        <Campo titulo={t === 'T4' ? 'Dia da folga (quitação)' : 'Data da folga'}>
          <input type="date" value={f.dataFolga} onChange={e => set('dataFolga', e.target.value)} className={input} />
        </Campo>
      )}

      {dica && (
        <p className="text-xs text-amber-700">
          {dica.nome} ({dica.tipo}) no calendário de Mogi.{' '}
          {usaMotivo && (
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => set('motivo', dica.tipo === 'facultativo' ? 'ponto facultativo municipal' : dica.nome)}
            >
              Usar como motivo
            </button>
          )}
        </p>
      )}

      {usaMotivo && (
        <Campo titulo="Motivo" dica={t === 'T2' ? 'Se ficar em branco, o texto usa "decreto municipal".' : undefined}>
          <input value={f.motivo} onChange={e => set('motivo', e.target.value)} placeholder="ex: ponto facultativo municipal" className={input} />
        </Campo>
      )}

      {usaAjuste && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{rotuloAjuste}</label>
            {onSugerirDias && (
              <button type="button" onClick={onSugerirDias} className="text-xs font-semibold text-slate-600 underline hover:text-slate-900">
                Sugerir dias
              </button>
            )}
          </div>
          <ListaDatas datas={f.datasAjuste} onChange={d => set('datasAjuste', d)} />
        </div>
      )}

      <Campo
        titulo={t === 'T4' ? 'Prazo limite' : 'Prazo limite (se cruzar o mês)'}
        dica="Máximo de 6 meses. Obrigatório no banco de horas e quando os dias passam para o mês seguinte."
      >
        <input type="date" value={f.prazoLimite} onChange={e => set('prazoLimite', e.target.value)} className={input} />
      </Campo>
    </div>
  )
}
