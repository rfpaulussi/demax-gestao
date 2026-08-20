'use client'

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { registrarAtestado } from '@/app/(admin)/efetivo/actions'
import { extrairCodigoCid, motivoIndicaOcupacional, ultimoDiaAfastadoAntesDoRetorno } from '@/lib/auditoria-atestados/parse'
import type { LinhaResultado } from '@/lib/auditoria-atestados/tipos'

type CidOpt = { codigo: string; descricao: string }
type LinhaNaoLancada = Extract<LinhaResultado, { status: 'nao_lancado' }>

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600'
const inputClass = 'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600'

interface Props {
  linha: LinhaNaoLancada
  cids: CidOpt[]
  open: boolean
  onClose: () => void
  onLancado: () => void
}

export function ModalLancarAtestado({ linha, cids, open, onClose, onLancado }: Props) {
  const cidSugerido = extrairCodigoCid(linha.sesmt.cidTexto)
  const [pending, setPending] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [dataInicio, setDataInicio] = useState(linha.sesmt.dataInicio)
  const [dataFim, setDataFim] = useState(ultimoDiaAfastadoAntesDoRetorno(linha.sesmt.dataRetorno))
  const [cidCodigo, setCidCodigo] = useState(cidSugerido ?? '')
  const [semCid, setSemCid] = useState(cidSugerido === null)
  const [origemOcupacional, setOrigemOcupacional] = useState(
    motivoIndicaOcupacional(linha.sesmt.motivo) ? 'doenca_ocupacional' : '',
  )

  function resetState() {
    setErro(null)
    setDataInicio(linha.sesmt.dataInicio)
    setDataFim(ultimoDiaAfastadoAntesDoRetorno(linha.sesmt.dataRetorno))
    setCidCodigo(cidSugerido ?? '')
    setSemCid(cidSugerido === null)
    setOrigemOcupacional(motivoIndicaOcupacional(linha.sesmt.motivo) ? 'doenca_ocupacional' : '')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!linha.postoId) {
      setErro('Funcionário sem posto vinculado no sistema — lance manualmente pela tela Efetivo.')
      return
    }
    const fd = new FormData()
    fd.set('funcionario_id', linha.funcionarioId)
    fd.set('posto_id', linha.postoId)
    fd.set('data_inicio', dataInicio)
    fd.set('data_fim', dataFim)
    fd.set('motivo', linha.sesmt.motivo)
    fd.set('cid_codigo', semCid ? '' : cidCodigo)
    fd.set('sem_cid', semCid ? 'true' : 'false')
    fd.set('origem_ocupacional', origemOcupacional)

    setPending(true)
    setErro(null)
    try {
      await registrarAtestado(fd)
      onLancado()
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao lançar atestado')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={isOpen => { if (!isOpen) { resetState(); onClose() } }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-1 text-lg font-semibold">Lançar Atestado (do SESMT)</Dialog.Title>
          <p className="mb-4 text-sm text-gray-500">{linha.sesmt.nome}</p>

          <div className="mb-4 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Dados pré-preenchidos com base na planilha do SESMT. Revise antes de salvar.
          </div>

          {!linha.postoId && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              Funcionário sem posto vinculado no sistema — não é possível lançar por aqui. Use a tela Efetivo.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Data Início</label>
                <input
                  type="date"
                  required
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Data Fim</label>
                <input
                  type="date"
                  required
                  min={dataInicio || undefined}
                  value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className={labelClass + ' mb-0'}>
                  CID <span className="font-normal normal-case tracking-normal text-gray-400">(opcional)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={semCid}
                    onChange={e => { setSemCid(e.target.checked); if (e.target.checked) setCidCodigo('') }}
                    className="rounded"
                  />
                  Sem CID
                </label>
              </div>
              <input
                list="cids-lancar-datalist"
                disabled={semCid}
                value={semCid ? '' : cidCodigo}
                onChange={e => {
                  const valor = e.target.value
                  const match = cids.find(c => `${c.codigo} — ${c.descricao}` === valor || c.codigo === valor)
                  setCidCodigo(match ? match.codigo : valor)
                }}
                placeholder={semCid ? 'Sem CID informado' : 'Buscar por código ou descrição...'}
                autoComplete="off"
                className={`${inputClass} ${semCid ? 'bg-gray-50 text-gray-400' : ''}`}
              />
              <datalist id="cids-lancar-datalist">
                {cids.map(c => (
                  <option key={c.codigo} value={`${c.codigo} — ${c.descricao}`} />
                ))}
              </datalist>
            </div>

            <div>
              <label className={labelClass}>
                Origem <span className="font-normal normal-case tracking-normal text-gray-400">(opcional)</span>
              </label>
              <select
                value={origemOcupacional}
                onChange={e => setOrigemOcupacional(e.target.value)}
                className={inputClass}
              >
                <option value="">Não ocupacional</option>
                <option value="acidente_trabalho">Acidente de Trabalho</option>
                <option value="doenca_ocupacional">Doença Ocupacional</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Motivo (do SESMT)</label>
              <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">{linha.sesmt.motivo}</p>
            </div>

            {erro && (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
            )}

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
                disabled={pending || !linha.postoId}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {pending ? 'Salvando...' : 'Lançar atestado'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
