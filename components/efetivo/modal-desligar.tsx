'use client'

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { solicitarDesligamento } from '@/app/(admin)/efetivo/actions'
import type { FuncionarioRow } from './funcionarios-table'

interface Props {
  funcionario: FuncionarioRow
  open: boolean
  onClose: () => void
}

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600'
const inputClass = 'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600'

export type TipoDesligamento = 'voluntaria' | 'demissao' | 'reprova_experiencia' | 'judicial' | 'outros'

export const TIPOS_DESLIGAMENTO: { value: TipoDesligamento; label: string }[] = [
  { value: 'voluntaria',          label: 'Voluntária (pedido do funcionário)' },
  { value: 'demissao',            label: 'Demissão (iniciativa da empresa)' },
  { value: 'reprova_experiencia', label: 'Reprova de Experiência (até 90 dias)' },
  { value: 'judicial',            label: 'Judicial (rescisão indireta, ação trabalhista)' },
  { value: 'outros',              label: 'Outros (falecimento, aposentadoria, invalidez)' },
]

export const MOTIVOS_POR_TIPO: Record<TipoDesligamento, { value: string; label: string }[]> = {
  voluntaria: [
    { value: 'pessoal',            label: 'Motivo Pessoal' },
    { value: 'salario',            label: 'Insatisfação Salarial' },
    { value: 'adaptacao',          label: 'Dificuldade de Adaptação' },
    { value: 'transferencia',      label: 'Transferência / Mudança' },
    { value: 'outra_oportunidade', label: 'Outra Oportunidade de Emprego' },
    { value: 'aposentadoria',      label: 'Aposentadoria' },
  ],
  demissao: [
    { value: 'corte_custo',         label: 'Corte de Custo / Redução de Quadro' },
    { value: 'fim_contrato',        label: 'Término de Contrato / Serviço' },
    { value: 'justa_causa',         label: 'Justa Causa (Art. 482 CLT)' },
    { value: 'desempenho',          label: 'Baixo Desempenho' },
    { value: 'comportamental',      label: 'Conduta / Comportamento' },
    { value: 'faltas_excessivas',   label: 'Faltas Excessivas' },
    { value: 'abandono',            label: 'Abandono de Emprego' },
    { value: 'deficiencia_tecnica', label: 'Deficiência Técnica' },
  ],
  reprova_experiencia: [
    { value: 'comportamental',      label: 'Conduta / Comportamento' },
    { value: 'desempenho',          label: 'Baixo Desempenho' },
    { value: 'deficiencia_tecnica', label: 'Deficiência Técnica' },
    { value: 'faltas_excessivas',   label: 'Faltas Excessivas' },
    { value: 'adaptacao',           label: 'Dificuldade de Adaptação' },
    { value: 'abandono',            label: 'Abandono de Emprego' },
  ],
  judicial: [
    { value: 'rescisao_indireta',  label: 'Rescisão Indireta (Art. 483 CLT)' },
    { value: 'acao_insalubridade', label: 'Ação de Insalubridade' },
    { value: 'acao_trabalhista',   label: 'Ação Trabalhista (outros)' },
    { value: 'culpa_reciproca',    label: 'Culpa Recíproca (Art. 484 CLT)' },
    { value: 'acordo_mutuo',       label: 'Acordo Entre Partes (Art. 484-A CLT)' },
  ],
  outros: [
    { value: 'falecimento',     label: 'Falecimento' },
    { value: 'aposentadoria',   label: 'Aposentadoria' },
    { value: 'invalidez',       label: 'Invalidez Permanente' },
    { value: 'fim_experiencia', label: 'Fim da Experiência (não efetivado)' },
  ],
}

export function ModalDesligar({ funcionario, open, onClose }: Props) {
  const [pending, setPending] = useState(false)
  const [tipo, setTipo]       = useState<TipoDesligamento | ''>('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    data.set('funcionario_id', funcionario.id)
    setPending(true)
    try {
      await solicitarDesligamento(data)
      form.reset()
      setTipo('')
      onClose()
    } finally {
      setPending(false)
    }
  }

  const motivos = tipo ? MOTIVOS_POR_TIPO[tipo] : []

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-1 text-lg font-semibold">Solicitar Desligamento</Dialog.Title>
          <p className="mb-4 text-sm text-gray-500">{funcionario.nome}</p>

          <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Esta solicitação será enviada para aprovação do administrador antes de ser efetivada.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>Data de Desligamento</label>
              <input
                type="date"
                name="data_desligamento"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Tipo de Desligamento</label>
              <select
                name="tipo_desligamento"
                required
                value={tipo}
                onChange={e => setTipo(e.target.value as TipoDesligamento | '')}
                className={inputClass}
              >
                <option value="">Selecione o tipo...</option>
                {TIPOS_DESLIGAMENTO.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {tipo && (
              <div>
                <label className={labelClass}>Motivação</label>
                <select
                  name="motivo"
                  required
                  className={inputClass}
                >
                  <option value="">Selecione a motivação...</option>
                  {motivos.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
                Cancelar
              </button>
              <button type="submit" disabled={pending} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                {pending ? 'Enviando...' : 'Enviar Solicitação'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
