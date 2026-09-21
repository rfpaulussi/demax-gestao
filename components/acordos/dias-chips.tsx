'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { fmtDataBR } from '@/lib/acordos/tempo'
import { rotuloDiaChip } from '@/lib/acordos/resumo'
import { INPUT_CLS } from './passo'

interface Props {
  datas: string[]
  /** Chamado com a lista nova quando o usuário adiciona/remove um dia (o pai marca `diasManual`). */
  onChange: (datas: string[]) => void
  diasManual: boolean
  onRecalcular: () => void
  /** "8 dias × 66 min = 8h48 a repor" */
  conta: string | null
  erro?: string | null
}

export function DiasChips({ datas, onChange, diasManual, onRecalcular, conta, erro }: Props) {
  const [adicionando, setAdicionando] = useState(false)
  const [nova, setNova] = useState('')

  function adicionar() {
    if (!nova || datas.includes(nova)) return
    onChange([...datas, nova].sort())
    setNova('')
    setAdicionando(false)
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {diasManual ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">editado manualmente</span>
        ) : (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">sugerido automaticamente</span>
        )}
        {diasManual && (
          <button type="button" onClick={onRecalcular} className="text-xs font-semibold text-slate-600 underline hover:text-slate-900">
            Recalcular dias
          </button>
        )}
      </div>

      {conta && <p className="text-sm font-semibold text-slate-800">{conta}</p>}

      {datas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {datas.map(d => {
            const r = rotuloDiaChip(d, datas[0])
            const br = fmtDataBR(d).slice(0, 5)
            return (
              <button
                key={d}
                type="button"
                onClick={() => onChange(datas.filter(x => x !== d))}
                aria-label={`Remover dia ${br}`}
                title={`Clique para remover ${fmtDataBR(d)}`}
                className="group relative flex w-14 flex-col items-center rounded-lg border border-green-200 bg-green-50 px-1 py-1.5 text-green-800 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
              >
                <span className="text-[11px] leading-none">{r.semana}</span>
                <span className="text-lg font-bold leading-tight">{r.dia}</span>
                <span className="h-3 text-[10px] leading-none">{r.mes ?? ''}</span>
                <X className="absolute right-0.5 top-0.5 hidden h-3 w-3 group-hover:block" aria-hidden />
              </button>
            )
          })}
        </div>
      )}

      {erro && <p className="text-xs font-medium text-red-600">{erro}</p>}

      {adicionando ? (
        <div className="flex max-w-xs gap-2">
          <input type="date" value={nova} onChange={e => setNova(e.target.value)} className={INPUT_CLS} aria-label="Outro dia" />
          <button
            type="button"
            onClick={adicionar}
            className="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-700"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </button>
          <button type="button" onClick={() => { setAdicionando(false); setNova('') }} className="text-xs text-gray-500 underline">
            cancelar
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdicionando(true)} className="text-xs font-semibold text-slate-600 underline hover:text-slate-900">
          Adicionar outro dia
        </button>
      )}
    </div>
  )
}
