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
  horaDispensa: string
  motivo: string
  dataFolga: string
  datasAjuste: string[]
  prazoLimite: string
}

export const FORM_VAZIO: FormState = {
  dataEvento: '', nomeEvento: '', periodoInicio: '', periodoFim: '', duracao: '',
  horaDispensa: '', motivo: '', dataFolga: '', datasAjuste: [], prazoLimite: '',
}

export function montarCampos(template: TemplateId, f: FormState): CamposAcordo {
  const usaEvento = template === 'T1' || template === 'T2' || template === 'T5'
  const usaPeriodo = template === 'T1' || template === 'T5'
  const usaFolga = template === 'T3' || template === 'T4' || template === 'T5'
  const usaMotivo = template === 'T2' || template === 'T3' || template === 'T4'
  // Só repassa o que o template mostra: campos ocultos preenchidos antes não podem vazar para validação/gravação
  return {
    template,
    dataEvento: usaEvento ? f.dataEvento || undefined : undefined,
    nomeEvento: usaEvento ? f.nomeEvento || undefined : undefined,
    periodoInicio: usaPeriodo ? f.periodoInicio || undefined : undefined,
    periodoFim: usaPeriodo ? f.periodoFim || undefined : undefined,
    // T1/T5 com período: o lib calcula por funcionário; aqui vai só a duração digitada
    minutosOrigem: usaPeriodo && f.duracao ? hhmmParaMin(f.duracao) : 0,
    horaDispensa: template === 'T2' ? f.horaDispensa || undefined : undefined,
    motivo: usaMotivo ? f.motivo || undefined : undefined,
    dataFolga: usaFolga ? f.dataFolga || undefined : undefined,
    datasAjuste: template === 'T5' ? [] : f.datasAjuste,
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

const MOTIVOS_RAPIDOS: Partial<Record<TemplateId, string[]>> = {
  T2: ['decreto municipal', 'acordado com a direção da unidade'],
  T3: ['ponto facultativo municipal', 'decreto municipal', 'acordado com a direção da unidade'],
  T4: ['ponto facultativo municipal', 'decreto municipal', 'acordado com a direção da unidade'],
}

interface Props {
  template: TemplateId
  f: FormState
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  feriados: MapaFeriados
  diasManual: boolean
  onDatasManuais: () => void
  onRecalcular: () => void
}

export function CamposTemplate({ template: t, f, set, feriados, diasManual, onDatasManuais, onRecalcular }: Props) {
  const usaEvento = t === 'T1' || t === 'T2' || t === 'T5'
  const usaPeriodo = t === 'T1' || t === 'T5'
  const usaFolga = t === 'T3' || t === 'T4' || t === 'T5'
  const usaMotivo = t === 'T2' || t === 'T3' || t === 'T4'
  const usaAjuste = t !== 'T5'
  const rotuloAjuste = t === 'T1' ? 'Dias de redução da jornada' : 'Dias de acréscimo da jornada'
  const dataDica = t === 'T1' || t === 'T2' ? f.dataEvento : t === 'T5' ? f.dataFolga || f.dataEvento : f.dataFolga
  const dica = dataDica ? feriados.get(dataDica) : undefined

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
        <Campo titulo="Horário de dispensa" dica="Cada funcionário é comparado ao horário de saída do próprio turno.">
          <input type="time" value={f.horaDispensa} onChange={e => set('horaDispensa', e.target.value)} className={input} />
        </Campo>
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
              onClick={() => set('motivo', dica.tipo === 'facultativo' ? 'ponto facultativo municipal' : `feriado ${dica.nome}`)}
            >
              Usar como motivo
            </button>
          )}
        </p>
      )}

      {usaMotivo && (
        <Campo titulo="Motivo" dica={t === 'T2' ? 'Se ficar em branco, o texto usa "decreto municipal".' : undefined}>
          <input value={f.motivo} onChange={e => set('motivo', e.target.value)} placeholder="ex: ponto facultativo municipal" className={input} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(MOTIVOS_RAPIDOS[t] ?? []).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => set('motivo', m)}
                className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {m}
              </button>
            ))}
          </div>
        </Campo>
      )}

      {usaAjuste && (
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{rotuloAjuste}</label>
              {diasManual ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">editado manualmente</span>
              ) : (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">sugerido automaticamente</span>
              )}
            </div>
            {diasManual && (
              <button type="button" onClick={onRecalcular} className="text-xs font-semibold text-slate-600 underline hover:text-slate-900">
                Recalcular dias
              </button>
            )}
          </div>
          <ListaDatas
            datas={f.datasAjuste}
            onChange={d => { onDatasManuais(); set('datasAjuste', d) }}
          />
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
