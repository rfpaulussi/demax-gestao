// components/auditoria-atestados/modal-solicitar-correcao.tsx
'use client'

import { useMemo, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { solicitarCorrecaoAtestado, type CamposCorrecao } from '@/app/(admin)/auditoria-atestados/actions'
import { extrairCodigoCid, fimSesmt } from '@/lib/auditoria-atestados/parse'
import type { LinhaResultado } from '@/lib/auditoria-atestados/tipos'

type LinhaDivergente = Extract<LinhaResultado, { status: 'divergencia' }>
type CampoProposto = { chave: 'dataInicio' | 'dataFim' | 'cidCodigo'; label: string; antes: string; depois: string; valor: string }

function fmt(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

interface Props {
  linha: LinhaDivergente
  cids: { codigo: string; descricao: string }[]
  open: boolean
  onClose: () => void
  onEnviado: () => void
}

/** Só propõe o que o SESMT afirma e o sistema consegue receber (CID precisa existir na tabela
 *  de referência, senão a aprovação falharia por FK). Origem ocupacional fica de fora: o SESMT
 *  não distingue acidente de doença — ajuste manual em Atestados. */
export function ModalSolicitarCorrecao({ linha, cids, open, onClose, onEnviado }: Props) {
  const { propostos, avisos } = useMemo(() => {
    const propostos: CampoProposto[] = []
    const avisos: string[] = []
    const dv = linha.camposDivergentes
    if (dv.includes('data_inicio')) {
      propostos.push({ chave: 'dataInicio', label: 'Início', antes: fmt(linha.sistema.dataInicio), depois: fmt(linha.sesmt.dataInicio), valor: linha.sesmt.dataInicio })
    }
    const fim = fimSesmt(linha.sesmt.diasTexto, linha.sesmt.dataRetorno)
    if (dv.includes('data_fim') && fim) {
      propostos.push({ chave: 'dataFim', label: 'Fim', antes: fmt(linha.sistema.dataFim), depois: fmt(fim), valor: fim })
    }
    if (dv.includes('cid')) {
      const cid = extrairCodigoCid(linha.sesmt.cidTexto)
      if (!cid) avisos.push('SESMT sem CID — nada a propor para o CID.')
      else if (!cids.some(c => c.codigo === cid)) avisos.push(`CID ${cid} não existe na tabela de referência do sistema — cadastre-o antes de propor essa correção.`)
      else propostos.push({ chave: 'cidCodigo', label: 'CID', antes: linha.sistema.cidCodigo ?? 'Sem CID', depois: cid, valor: cid })
    }
    if (dv.includes('origem_ocupacional')) avisos.push('Origem ocupacional diverge — ajuste manualmente em Atestados (o SESMT não distingue acidente de doença).')
    return { propostos, avisos }
  }, [linha, cids])

  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(propostos.map(p => p.chave)))
  const [pending, setPending] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar() {
    const campos: CamposCorrecao = {}
    for (const p of propostos) {
      if (!marcados.has(p.chave)) continue
      if (p.chave === 'cidCodigo') campos.cidCodigo = p.valor
      else campos[p.chave] = p.valor
    }
    setPending(true)
    setErro(null)
    const r = await solicitarCorrecaoAtestado(linha.sistema.id, campos)
    setPending(false)
    if (!r.success) { setErro(r.error); return }
    onEnviado()
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={isOpen => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-1 text-lg font-semibold">Solicitar correção de atestado</Dialog.Title>
          <p className="mb-4 text-sm text-gray-500">{linha.sesmt.nome}</p>

          <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Nada é alterado agora: a correção vai para <strong>Aprovações</strong> e só é aplicada quando o admin aprovar.
          </div>

          {propostos.length === 0 ? (
            <p className="mb-4 text-sm text-gray-500">Nenhuma correção automática possível para esta divergência.</p>
          ) : (
            <ul className="mb-4 space-y-2">
              {propostos.map(p => (
                <li key={p.chave} className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={marcados.has(p.chave)}
                    onChange={e => setMarcados(prev => { const n = new Set(prev); if (e.target.checked) n.add(p.chave); else n.delete(p.chave); return n })}
                  />
                  <span className="w-12 text-xs font-semibold uppercase tracking-widest text-gray-500">{p.label}</span>
                  <span className="text-gray-500">{p.antes}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-semibold text-gray-900">{p.depois}</span>
                </li>
              ))}
            </ul>
          )}

          {avisos.map(a => (
            <p key={a} className="mb-2 text-xs text-gray-500">ℹ️ {a}</p>
          ))}
          {erro && <p className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
              Cancelar
            </button>
            <button
              type="button"
              onClick={enviar}
              disabled={pending || marcados.size === 0 || propostos.length === 0}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {pending ? 'Enviando...' : 'Enviar para aprovação'}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
