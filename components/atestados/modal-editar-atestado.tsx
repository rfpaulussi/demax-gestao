'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { updateAtestado, getSobreposicoesAtestado, type SobreposicaoAtestado } from '@/app/(admin)/atestados/actions'
import type { AtestadoRow } from './atestados-client'

type CidOpt = { codigo: string; descricao: string }

interface Props {
  atestado: AtestadoRow | null
  onClose: () => void
  cids: CidOpt[]
}

export function ModalEditarAtestado({ atestado, onClose, cids }: Props) {
  const open = atestado !== null
  const [pending, setPending] = useState(false)
  const [erro, setErro] = useState('')
  const [cidBusca, setCidBusca] = useState('')
  const [cidCodigo, setCidCodigo] = useState('')
  const [cidAberto, setCidAberto] = useState(false)
  const [origemOcupacional, setOrigemOcupacional] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [sobreposicoes, setSobreposicoes] = useState<SobreposicaoAtestado[]>([])
  const cidRef = useRef<HTMLDivElement>(null)

  // Pre-preenche estado do CID e origem sempre que um novo atestado é aberto para edição.
  // Não pode depender de onOpenChange: esse callback só dispara em fechamentos originados
  // de dentro do dialog (Esc, overlay, botão) — não quando o pai abre o modal setando a prop.
  useEffect(() => {
    if (!atestado) return
    if (atestado.cid_codigo) {
      const found = cids.find(c => c.codigo === atestado.cid_codigo)
      setCidCodigo(atestado.cid_codigo)
      setCidBusca(found ? `${found.codigo} — ${found.descricao}` : atestado.cid_codigo)
    } else {
      setCidCodigo('')
      setCidBusca('')
    }
    setOrigemOcupacional(atestado.origem_ocupacional ?? '')
    setDataInicio(atestado.data_inicio)
    setDataFim(atestado.data_fim)
    setSobreposicoes([])
    setErro('')
  }, [atestado, cids])

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) onClose()
  }

  useEffect(() => {
    if (!atestado || !dataInicio || !dataFim) { setSobreposicoes([]); return }
    let cancelado = false
    const timer = setTimeout(() => {
      getSobreposicoesAtestado(atestado.funcionario_id, dataInicio, dataFim, atestado.id).then(res => {
        if (!cancelado) setSobreposicoes(res)
      })
    }, 300)
    return () => { cancelado = true; clearTimeout(timer) }
  }, [atestado, dataInicio, dataFim])

  const cidsFiltrados = cids.filter(c =>
    !cidBusca ||
    c.codigo.toLowerCase().includes(cidBusca.toLowerCase()) ||
    c.descricao.toLowerCase().includes(cidBusca.toLowerCase()),
  )

  function selecionarCid(c: CidOpt) {
    setCidCodigo(c.codigo)
    setCidBusca(`${c.codigo} — ${c.descricao}`)
    setCidAberto(false)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!atestado) return
    const form = e.currentTarget
    const data = new FormData(form)
    setPending(true)
    setErro('')
    try {
      const res = await updateAtestado(atestado.id, data)
      if (res.error) { setErro(res.error); return }
      onClose()
    } finally {
      setPending(false)
    }
  }

  if (!atestado) return null

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-1 text-lg font-semibold">Editar Atestado</Dialog.Title>
          <p className="mb-4 text-sm text-gray-500">{atestado.funcionario_nome}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                Data Início
              </label>
              <input
                type="date"
                name="data_inicio"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                required
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                Data Fim
              </label>
              <input
                type="date"
                name="data_fim"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                required
                min={dataInicio || undefined}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {sobreposicoes.length > 0 && (
              <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <p className="font-semibold">⚠ Período sobrepõe atestado(s) já registrado(s):</p>
                <ul className="mt-1 space-y-0.5">
                  {sobreposicoes.map((s, i) => (
                    <li key={i}>
                      {s.data_inicio.split('-').reverse().join('/')} – {s.data_fim.split('-').reverse().join('/')}
                      {s.cid_codigo ? ` (${s.cid_codigo})` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                Motivo
              </label>
              <textarea
                name="motivo"
                rows={3}
                defaultValue={atestado.motivo ?? ''}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                CID <span className="font-normal normal-case tracking-normal text-gray-400">(opcional)</span>
              </label>
              <div ref={cidRef} className="relative">
                <input
                  type="text"
                  value={cidBusca}
                  onChange={e => {
                    setCidBusca(e.target.value)
                    setCidCodigo('')
                    setCidAberto(true)
                  }}
                  onFocus={() => setCidAberto(true)}
                  onBlur={() => setTimeout(() => setCidAberto(false), 150)}
                  placeholder="Buscar por código ou descrição..."
                  autoComplete="off"
                  className="w-full rounded border border-gray-300 px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                {cidCodigo && (
                  <button
                    type="button"
                    onClick={() => { setCidCodigo(''); setCidBusca('') }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Limpar CID"
                  >
                    ×
                  </button>
                )}
                {cidAberto && cidsFiltrados.length > 0 && (
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
                <input type="hidden" name="cid_codigo" value={cidCodigo} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                Origem <span className="font-normal normal-case tracking-normal text-gray-400">(opcional)</span>
              </label>
              <select
                name="origem_ocupacional"
                value={origemOcupacional}
                onChange={e => setOrigemOcupacional(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">Não ocupacional</option>
                <option value="acidente_trabalho">Acidente de Trabalho</option>
                <option value="doenca_ocupacional">Doença Ocupacional</option>
              </select>
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
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
