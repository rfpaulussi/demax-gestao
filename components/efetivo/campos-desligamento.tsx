'use client'

import { useEffect, useState } from 'react'
import { exigeAviso } from '@/lib/desligamentos/comunicado'
import { TIPOS_DESLIGAMENTO, MOTIVOS_POR_TIPO, type TipoDesligamento } from './modal-desligar'

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500'
const inputClass =
  'w-full rounded border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600'

/** Campos do pedido de desligamento (data, tipo, motivação, aviso, motivo livre). Vive dentro de um <form>;
 *  os nomes batem com o que `solicitarDesligamento` lê. Desmontar o componente zera o estado. */
export function CamposDesligamento({ emExperiencia }: { emExperiencia: boolean }) {
  const [tipoDeslig, setTipoDeslig] = useState<TipoDesligamento | ''>('')
  const [motivoDeslig, setMotivoDeslig] = useState('')

  // Em período de experiência: já sugere "Reprova de Experiência".
  useEffect(() => {
    if (emExperiencia) setTipoDeslig('reprova_experiencia')
  }, [emExperiencia])

  return (
    <>
      <div>
        <label className={labelClass}>Data de Desligamento (início do aviso)</label>
        <input type="date" name="data_desligamento" required className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Tipo de Desligamento</label>
        <select
          name="tipo_desligamento"
          required
          value={tipoDeslig}
          onChange={e => { setTipoDeslig(e.target.value as TipoDesligamento | ''); setMotivoDeslig('') }}
          className={inputClass}
        >
          <option value="">Selecione o tipo...</option>
          {TIPOS_DESLIGAMENTO.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        {emExperiencia && (
          <p className="mt-1 text-xs text-purple-600">Funcionário em período de experiência — sugerido: Reprova de Experiência.</p>
        )}
      </div>
      {tipoDeslig && (
        <div>
          <label className={labelClass}>Motivação</label>
          <select name="motivo" required value={motivoDeslig} onChange={e => setMotivoDeslig(e.target.value)} className={inputClass}>
            <option value="">Selecione a motivação...</option>
            {MOTIVOS_POR_TIPO[tipoDeslig].map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      )}
      {motivoDeslig && exigeAviso(tipoDeslig, motivoDeslig) && (
        <div>
          <label className={labelClass}>Aviso Prévio</label>
          <select name="aviso" required defaultValue="" className={inputClass}>
            <option value="">Selecione...</option>
            <option value="trabalhado">Trabalhado</option>
            <option value="indenizado">Indenizado</option>
          </select>
        </div>
      )}
      <div>
        <label className={labelClass}>Motivo(s) — sai no comunicado impresso</label>
        <textarea
          name="motivo_texto"
          rows={3}
          placeholder="Descreva o motivo do desligamento..."
          className={inputClass}
        />
      </div>
      <p className="text-xs text-gray-400">
        Ao enviar, o comunicado de desligamento fica disponível em Aprovações para impressão.
      </p>
    </>
  )
}
