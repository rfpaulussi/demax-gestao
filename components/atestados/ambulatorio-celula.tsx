'use client'

import { useRef, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { enviarAoAmbulatorio } from '@/lib/atestados/ambulatorio/enviar-cliente'

const MAX_ANEXO = 4 * 1024 * 1024

function formatarEnvio(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

/** Selo "Enviado ao ambulatório" ou "Não enviado", com o botão para enviar (ou reenviar) o arquivo. */
export function AmbulatorioCelula({ atestadoId, funcionarioNome, enviadoEm }: {
  atestadoId: string
  funcionarioNome: string
  enviadoEm: string | null
}) {
  const [enviado, setEnviado] = useState<string | null>(enviadoEm)
  const [aberto, setAberto] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function fechar() {
    if (enviando) return
    setAberto(false); setArquivo(null); setErro(null)
  }

  function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.type === 'application/pdf' && f.size > MAX_ANEXO) { setErro('PDF grande demais (máximo 4 MB).'); return }
    setErro(null)
    setArquivo(f)
  }

  async function enviar() {
    if (!arquivo) return
    setEnviando(true)
    setErro(null)
    const r = await enviarAoAmbulatorio(atestadoId, arquivo)
    setEnviando(false)
    if (!r.ok) { setErro(r.erro); return }
    setEnviado(r.enviadoEm)
    setAberto(false)
    setArquivo(null)
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {enviado ? (
        <span
          title="Atestado enviado por e-mail ao ambulatório"
          className="inline-flex items-center whitespace-nowrap rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700 ring-1 ring-inset ring-green-200"
        >
          ✓ Enviado {formatarEnvio(enviado)}
        </span>
      ) : (
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500 ring-1 ring-inset ring-gray-200">
          Não enviado
        </span>
      )}
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="text-[11px] font-medium text-blue-700 hover:underline"
      >
        {enviado ? 'Reenviar' : 'Enviar ao ambulatório'}
      </button>

      <Dialog.Root open={aberto} onOpenChange={o => { if (!o) fechar() }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
            <Dialog.Title className="mb-1 text-lg font-semibold">Enviar ao ambulatório</Dialog.Title>
            <p className="mb-4 text-sm text-gray-500">{funcionarioNome}</p>

            <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={escolher} />
            {arquivo ? (
              <div className="flex items-center justify-between gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                <span className="truncate">📎 {arquivo.name}</span>
                <button type="button" onClick={() => inputRef.current?.click()} className="shrink-0 font-medium text-blue-700 hover:underline">Trocar</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="w-full rounded border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-600 hover:bg-gray-50"
              >
                Escolher foto ou PDF do atestado
              </button>
            )}
            <p className="mt-2 text-xs text-gray-400">
              O arquivo só segue por e-mail; o sistema não o guarda.
            </p>

            {erro && (
              <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={fechar}
                disabled={enviando}
                className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void enviar()}
                disabled={!arquivo || enviando}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {enviando ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
