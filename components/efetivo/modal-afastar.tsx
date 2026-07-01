'use client'

import { useState, useTransition } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { solicitarAfastamento } from '@/app/(admin)/efetivo/actions'
import type { FuncionarioRow } from './funcionarios-table'

interface Props {
  funcionario: FuncionarioRow
  open: boolean
  onClose: () => void
}

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600'
const inputClass = 'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600'

const MOTIVOS_MEDICOS = ['INSS - Doença', 'INSS - Acidente de Trabalho']

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return dt.toISOString().slice(0, 10)
}

export function ModalAfastar({ funcionario, open, onClose }: Props) {
  const [erro, setErro]                       = useState<string | null>(null)
  const [pending, start]                      = useTransition()
  const [motivo, setMotivo]                   = useState('')
  const [dataInicio, setDataInicio]           = useState('')
  const [dias, setDias]                       = useState('')
  const [dataRetorno, setDataRetorno]         = useState('')
  const [incluirAtestado, setIncluirAtestado] = useState(true)

  const ehMedico = MOTIVOS_MEDICOS.includes(motivo)

  function handleDiasChange(val: string) {
    setDias(val)
    const n = parseInt(val)
    if (dataInicio && n > 0) {
      setDataRetorno(addDays(dataInicio, n))
    } else if (!val) {
      setDataRetorno('')
    }
  }

  function handleDataInicioChange(val: string) {
    setDataInicio(val)
    const n = parseInt(dias)
    if (val && n > 0) {
      setDataRetorno(addDays(val, n))
    }
  }

  function resetState() {
    setErro(null)
    setMotivo('')
    setDataInicio('')
    setDias('')
    setDataRetorno('')
    setIncluirAtestado(true)
  }

  function handleClose() {
    if (pending) return
    resetState()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const fd = new FormData(e.currentTarget)
    fd.set('funcionario_id', funcionario.id)
    fd.set('data_inicio', dataInicio)
    fd.set('data_retorno_prevista', dataRetorno)
    fd.set('eh_medico', (ehMedico && incluirAtestado) ? 'true' : 'false')
    if (dias) fd.set('dias', dias)

    start(async () => {
      const result = await solicitarAfastamento(fd)
      if (!result.success) {
        setErro(result.error)
        return
      }
      handleClose()
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-1 text-lg font-semibold">Solicitar Afastamento</Dialog.Title>
          <p className="mb-4 text-sm text-gray-500">{funcionario.nome}</p>

          <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Esta solicitação será enviada para aprovação do administrador antes de ser efetivada.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>Motivo do Afastamento</label>
              <select
                name="motivo"
                required
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                className={inputClass}
              >
                <option value="">Selecione...</option>
                <option value="INSS - Doença">INSS — Doença</option>
                <option value="INSS - Acidente de Trabalho">INSS — Acidente de Trabalho</option>
                <option value="Licença Maternidade">Licença Maternidade</option>
                <option value="Licença Paternidade">Licença Paternidade</option>
                <option value="Afastamento Judicial">Afastamento Judicial</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            {/* Data início + Dias → Data Retorno automática */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Data de Início</label>
                <input
                  type="date"
                  required
                  value={dataInicio}
                  onChange={e => handleDataInicioChange(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Dias de Afastamento</label>
                <input
                  type="number"
                  min="1"
                  max="1825"
                  placeholder="Ex: 180"
                  value={dias}
                  onChange={e => handleDiasChange(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Data Prevista de Retorno</label>
              <input
                type="date"
                value={dataRetorno}
                onChange={e => { setDataRetorno(e.target.value); setDias('') }}
                className={inputClass}
              />
              {dias && dataRetorno && (
                <p className="mt-1 text-xs text-slate-500">
                  Retorno previsto em {dias} dias de afastamento
                </p>
              )}
            </div>

            {ehMedico && (
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={incluirAtestado}
                    onChange={e => setIncluirAtestado(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 accent-slate-900"
                  />
                  <span className="text-sm text-gray-700">Registrar atestado junto</span>
                </label>
                {incluirAtestado ? (
                  <div className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    ✓ Atestado médico será registrado automaticamente junto com a solicitação.
                  </div>
                ) : (
                  <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    Afastamento registrado sem atestado — recomendado para INSS de longa duração.
                  </div>
                )}
              </div>
            )}

            {erro && (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {erro}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={pending}
                className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {pending ? 'Enviando...' : 'Enviar Solicitação'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
