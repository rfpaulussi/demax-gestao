'use client'

import { useEffect, useState, useTransition } from 'react'
import { ROLE_LABELS } from '@/types'
import type { Role } from '@/types'
import type { ComentarioRow } from '@/app/(admin)/ocorrencias/actions'
import { getComentarios, comentarOcorrencia } from '@/app/(admin)/ocorrencias/actions'
import { MAX_COMENTARIO } from '@/lib/ocorrencias/devolutiva'

function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export function ConversaOcorrencia({
  ocorrenciaId,
  onEnviado,
}: {
  ocorrenciaId: string
  onEnviado: () => void
}) {
  const [comentarios, setComentarios] = useState<ComentarioRow[] | null>(null)
  const [texto, setTexto]             = useState('')
  const [erro, setErro]               = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()

  async function carregar() {
    setComentarios(await getComentarios(ocorrenciaId))
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocorrenciaId])

  function handleEnviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    startTransition(async () => {
      const result = await comentarOcorrencia(ocorrenciaId, texto)
      if (result.success) {
        setTexto('')
        await carregar()
        onEnviado()
      } else {
        setErro(result.error)
      }
    })
  }

  return (
    <div className="space-y-3">
      {comentarios === null ? (
        <p className="text-xs text-gray-400">Carregando conversa…</p>
      ) : comentarios.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhuma mensagem ainda.</p>
      ) : (
        <div className="space-y-2">
          {comentarios.map(c => (
            <div
              key={c.id}
              className={`rounded-lg px-3 py-2 ${c.tipo === 'parecer' ? 'bg-green-50 ring-1 ring-green-200' : 'bg-gray-50'}`}
            >
              <p className="text-xs">
                <span className="font-semibold text-gray-900">{c.autor_nome}</span>
                {c.autor_role && (
                  <span className="text-gray-400"> · {ROLE_LABELS[c.autor_role as Role] ?? c.autor_role}</span>
                )}
                <span className="text-gray-400"> · {fmtDataHora(c.created_at)}</span>
                {c.tipo === 'parecer' && (
                  <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                    Parecer
                  </span>
                )}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{c.texto}</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleEnviar} className="space-y-2">
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          rows={2}
          maxLength={MAX_COMENTARIO}
          placeholder="Escreva uma resposta…"
          className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
        />
        {erro && <p className="text-xs text-red-500">{erro}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending || !texto.trim()}
            className="h-8 rounded-lg bg-slate-900 px-3 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {isPending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </form>
    </div>
  )
}
