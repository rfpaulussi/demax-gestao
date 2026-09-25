'use client'

import { useEffect, useState, useTransition } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { getRascunhoRH, encaminharAoRH } from '@/app/(admin)/ocorrencias/actions'

const inputClass =
  'h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-sm text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

export function ModalEncaminharRH({
  ocorrenciaId,
  onClose,
  onEnviado,
}: {
  ocorrenciaId: string
  onClose: () => void
  onEnviado: () => void
}) {
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga]   = useState<string | null>(null)
  const [para, setPara]             = useState('')
  const [assunto, setAssunto]       = useState('')
  const [corpo, setCorpo]           = useState('')
  const [erro, setErro]             = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let ativo = true
    ;(async () => {
      const r = await getRascunhoRH(ocorrenciaId)
      if (!ativo) return
      if (r.success) {
        setPara(r.para)
        setAssunto(r.assunto)
        setCorpo(r.corpo)
      } else {
        setErroCarga(r.error)
      }
      setCarregando(false)
    })()
    return () => { ativo = false }
  }, [ocorrenciaId])

  function handleEnviar() {
    setErro(null)
    startTransition(async () => {
      const r = await encaminharAoRH(ocorrenciaId, { para, assunto, corpo })
      if (r.success) {
        onEnviado()
        onClose()
      } else {
        setErro(r.error)
      }
    })
  }

  return (
    <Dialog.Root open onOpenChange={(aberto) => { if (!aberto) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[61] max-h-[90vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
          <Dialog.Title className="mb-1 text-sm font-bold uppercase tracking-widest text-gray-900">
            Encaminhar ao RH
          </Dialog.Title>

          {carregando ? (
            <p className="py-10 text-center text-sm text-gray-400">Montando o rascunho…</p>
          ) : erroCarga ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-500">{erroCarga}</p>
              <button
                onClick={onClose}
                className="mt-4 h-8 rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Este e-mail sai do sistema. Ele leva o que você ver abaixo, e você pode editar tudo.
                <strong> CPF, salário, PCD, CID e motivo de atestado nunca são incluídos</strong>, nem a conversa
                com o supervisor e as notas internas. O RH responde direto para o seu e-mail.
              </p>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Para</label>
                <input
                  type="text"
                  value={para}
                  onChange={e => setPara(e.target.value)}
                  placeholder="rh@empresa.com.br (vários: separe por vírgula)"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Assunto</label>
                <input
                  type="text"
                  value={assunto}
                  onChange={e => setAssunto(e.target.value)}
                  maxLength={200}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Mensagem</label>
                <textarea
                  value={corpo}
                  onChange={e => setCorpo(e.target.value)}
                  rows={16}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs leading-relaxed text-gray-700 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                />
              </div>

              {erro && <p className="text-xs text-red-500">{erro}</p>}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isPending || !para.trim() || !assunto.trim() || !corpo.trim()}
                  onClick={handleEnviar}
                  className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {isPending ? 'Enviando…' : 'Enviar ao RH'}
                </button>
              </div>
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
