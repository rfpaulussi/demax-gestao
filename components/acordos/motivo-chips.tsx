'use client'

import { useState } from 'react'
import { MOTIVOS } from '@/lib/acordos/motivos'
import { identificarMotivo, montarMotivoDecreto } from '@/lib/acordos/resumo'
import { INPUT_CLS, INPUT_ERRO_CLS } from './passo'

const GRUPOS = Array.from(new Set(MOTIVOS.map(m => m.grupo)))

const chip = (ativo: boolean) =>
  `rounded-full border px-2.5 py-1 text-xs font-medium transition ${
    ativo ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' : 'border-gray-200 bg-white text-slate-600 hover:bg-slate-50'
  }`

interface Props {
  motivo: string
  onChange: (motivo: string) => void
  /** Motivo sugerido pelo calendário de Mogi (quando a data casa). */
  sugestao?: string
  erro?: boolean
}

export function MotivoChips({ motivo, onChange, sugestao, erro }: Props) {
  const ident = identificarMotivo(motivo)
  const [outroAberto, setOutroAberto] = useState(ident.id === 'outro')
  const [decreto, setDecreto] = useState(ident.decreto)
  const ativoId = outroAberto ? 'outro' : ident.id

  function escolher(id: string, texto: string) {
    setOutroAberto(false)
    if (id === 'decreto-municipal') {
      setDecreto('')
      onChange(montarMotivoDecreto(''))
    } else {
      onChange(texto)
    }
  }

  return (
    <div className="space-y-2.5">
      {sugestao && motivo !== sugestao && (
        <button
          type="button"
          onClick={() => { setOutroAberto(false); onChange(sugestao) }}
          className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
        >
          usar &lsquo;{sugestao}&rsquo;
        </button>
      )}

      {GRUPOS.map(grupo => (
        <div key={grupo}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-gray-400">{grupo}</p>
          <div className="flex flex-wrap gap-1.5">
            {MOTIVOS.filter(m => m.grupo === grupo).map(m => (
              <button key={m.id} type="button" aria-pressed={ativoId === m.id} onClick={() => escolher(m.id, m.texto)} className={chip(ativoId === m.id)}>
                {m.rotulo}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-pressed={ativoId === 'outro'}
          onClick={() => { setOutroAberto(true); if (ident.id !== 'outro') onChange('') }}
          className={chip(ativoId === 'outro')}
        >
          outro…
        </button>
      </div>

      {ativoId === 'decreto-municipal' && (
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Nº do decreto (opcional)</label>
          <input
            value={decreto}
            onChange={e => { setDecreto(e.target.value); onChange(montarMotivoDecreto(e.target.value)) }}
            placeholder="ex: 12.345/2026"
            className={INPUT_CLS}
          />
        </div>
      )}

      {ativoId === 'outro' && (
        <input
          value={motivo}
          onChange={e => onChange(e.target.value)}
          placeholder="ex: reunião especial na unidade"
          className={erro ? INPUT_ERRO_CLS : INPUT_CLS}
          aria-label="Motivo (texto livre)"
        />
      )}
    </div>
  )
}
