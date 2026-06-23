'use client'

import { useRef, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { registrarAtestado } from '@/app/(admin)/efetivo/actions'
import type { FuncionarioRow } from './funcionarios-table'

type CidOpt = { codigo: string; descricao: string }

interface Props {
  funcionario: FuncionarioRow
  open: boolean
  onClose: () => void
  cids: CidOpt[]
}

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600'
const inputClass = 'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600'

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return dt.toISOString().slice(0, 10)
}

export function ModalAtestado({ funcionario, open, onClose, cids }: Props) {
  const [pending, setPending]     = useState(false)
  const [cidBusca, setCidBusca]   = useState('')
  const [cidCodigo, setCidCodigo] = useState('')
  const [cidAberto, setCidAberto] = useState(false)
  const [semCid, setSemCid]       = useState(false)
  const [dataInicio, setDataInicio] = useState('')
  const [dias, setDias]           = useState('')
  const [dataFim, setDataFim]     = useState('')
  const cidRef = useRef<HTMLDivElement>(null)

  const cidsFiltrados = cids.filter(c =>
    !cidBusca ||
    c.codigo.toLowerCase().includes(cidBusca.toLowerCase()) ||
    c.descricao.toLowerCase().includes(cidBusca.toLowerCase()),
  )

  function handleDiasChange(val: string) {
    setDias(val)
    const n = parseInt(val)
    if (dataInicio && n > 0) {
      setDataFim(addDays(dataInicio, n - 1))
    } else if (!val) {
      setDataFim('')
    }
  }

  function handleDataInicioChange(val: string) {
    setDataInicio(val)
    const n = parseInt(dias)
    if (val && n > 0) {
      setDataFim(addDays(val, n - 1))
    }
  }

  function selecionarCid(c: CidOpt) {
    setCidCodigo(c.codigo)
    setCidBusca(`${c.codigo} — ${c.descricao}`)
    setCidAberto(false)
  }

  function limparCid() {
    setCidCodigo('')
    setCidBusca('')
  }

  function resetState() {
    setCidCodigo('')
    setCidBusca('')
    setCidAberto(false)
    setSemCid(false)
    setDataInicio('')
    setDias('')
    setDataFim('')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    data.set('funcionario_id', funcionario.id)
    if (funcionario.posto_id) data.set('posto_id', funcionario.posto_id)
    data.set('data_inicio', dataInicio)
    data.set('data_fim', dataFim || (form.querySelector<HTMLInputElement>('[name=data_fim_manual]')?.value ?? ''))
    data.set('sem_cid', semCid ? 'true' : 'false')
    setPending(true)
    try {
      await registrarAtestado(data)
      form.reset()
      resetState()
      onClose()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) { resetState(); onClose() } }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-1 text-lg font-semibold">Registrar Atestado</Dialog.Title>
          <p className="mb-4 text-sm text-gray-500">{funcionario.nome}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Data início + Dias → Data fim automática */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Data Início</label>
                <input
                  type="date"
                  name="data_inicio_display"
                  required
                  value={dataInicio}
                  onChange={e => handleDataInicioChange(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Dias</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  placeholder="Ex: 15"
                  value={dias}
                  onChange={e => handleDiasChange(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Data Fim</label>
              <input
                type="date"
                name="data_fim_manual"
                required
                value={dataFim}
                onChange={e => { setDataFim(e.target.value); setDias('') }}
                className={inputClass}
              />
              {dias && dataFim && (
                <p className="mt-1 text-xs text-blue-600">
                  Calculado: {dias} dia{Number(dias) > 1 ? 's' : ''} de atestado
                </p>
              )}
            </div>

            <div>
              <label className={labelClass}>Motivo</label>
              <textarea
                name="motivo"
                rows={2}
                className={inputClass}
              />
            </div>

            {/* CID — combobox com busca */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className={labelClass + ' mb-0'}>
                  CID <span className="font-normal normal-case tracking-normal text-gray-400">(opcional)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={semCid}
                    onChange={e => {
                      setSemCid(e.target.checked)
                      if (e.target.checked) limparCid()
                    }}
                    className="rounded"
                  />
                  Atestado sem CID
                </label>
              </div>
              <div ref={cidRef} className="relative">
                <input
                  type="text"
                  value={semCid ? '' : cidBusca}
                  onChange={e => {
                    setCidBusca(e.target.value)
                    setCidCodigo('')
                    setCidAberto(true)
                  }}
                  onFocus={() => !semCid && setCidAberto(true)}
                  onBlur={() => setTimeout(() => setCidAberto(false), 150)}
                  placeholder={semCid ? 'Sem CID informado' : 'Buscar por código ou descrição...'}
                  disabled={semCid}
                  autoComplete="off"
                  className={`${inputClass} pr-8 ${semCid ? 'bg-gray-50 text-gray-400' : ''}`}
                />
                {cidCodigo && !semCid && (
                  <button
                    type="button"
                    onClick={limparCid}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Limpar CID"
                  >
                    ×
                  </button>
                )}
                {cidAberto && !semCid && cidsFiltrados.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-gray-200 bg-white shadow-lg">
                    {cidsFiltrados.map(c => (
                      <button
                        key={c.codigo}
                        type="button"
                        onMouseDown={() => selecionarCid(c)}
                        className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50"
                      >
                        <span className="shrink-0 font-mono font-semibold text-blue-700">{c.codigo}</span>
                        <span className="text-gray-600">{c.descricao}</span>
                      </button>
                    ))}
                  </div>
                )}
                <input type="hidden" name="cid_codigo" value={semCid ? '' : cidCodigo} />
              </div>
            </div>

            <div>
              <label className={labelClass}>
                Origem <span className="font-normal normal-case tracking-normal text-gray-400">(opcional)</span>
              </label>
              <select
                name="origem_ocupacional"
                defaultValue=""
                className={inputClass}
              >
                <option value="">Não ocupacional</option>
                <option value="acidente_trabalho">Acidente de Trabalho</option>
                <option value="doenca_ocupacional">Doença Ocupacional</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { resetState(); onClose() }}
                className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {pending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
