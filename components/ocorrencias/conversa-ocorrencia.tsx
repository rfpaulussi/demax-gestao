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
  onCiente,
}: {
  ocorrenciaId: string
  onEnviado: () => void
  /** Só para a gestão quando a bola está com ela: marca como visto, sem responder. */
  onCiente?: () => void
}) {
  const [comentarios, setComentarios] = useState<ComentarioRow[] | null>(null)
  const [texto, setTexto]             = useState('')
  const [soInformar, setSoInformar]   = useState(false)
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
      const result = await comentarOcorrencia(ocorrenciaId, texto, !soInformar)
      if (result.success) {
        setTexto('')
        setSoInformar(false)
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
          {comentarios.map(c => {
            const doSupervisor = c.autor_role === 'supervisor'
            return (
            <div
              key={c.id}
              className={`rounded-lg px-3 py-2 ${
                c.tipo === 'parecer'
                  ? 'bg-green-50 ring-1 ring-green-200'
                  : c.tipo === 'nota_interna'
                    ? 'bg-amber-50 ring-1 ring-amber-200'
                    : doSupervisor
                      ? 'mr-10 border-l-4 border-slate-300 bg-gray-50'
                      : 'ml-10 border-r-4 border-indigo-300 bg-indigo-50/60'
              }`}
            >
              <p className="text-xs">
                <span className="font-semibold text-gray-900">{c.autor_nome}</span>
                {c.autor_role && (
                  <span className="text-gray-400"> · {ROLE_LABELS[c.autor_role as Role] ?? c.autor_role}</span>
                )}
                <span className="text-gray-400"> · {fmtDataHora(c.created_at)}</span>
                {c.tipo === 'mensagem' && !c.requer_resposta && (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    Só informar
                  </span>
                )}
                {c.tipo === 'parecer' && (
                  <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                    Parecer
                  </span>
                )}
                {c.tipo === 'nota_interna' && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    Nota interna (só gestão)
                  </span>
                )}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{c.texto}</p>
            </div>
            )
          })}
        </div>
      )}

      {onCiente && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-rose-50 px-3 py-2">
          <p className="text-xs text-rose-700">A última mensagem é do supervisor. Se ela não pede resposta, dê ciente.</p>
          <button
            type="button"
            onClick={onCiente}
            className="h-8 flex-shrink-0 rounded-lg bg-emerald-600 px-3 text-xs font-semibold uppercase tracking-widest text-white hover:bg-emerald-700"
          >
            Ciente, sem resposta
          </button>
        </div>
      )}

      <form onSubmit={handleEnviar} className="space-y-2">
        <p className="text-xs text-gray-500">
          Conversa entre a gestão e o supervisor que registrou. Não é enviada ao RH. Quem recebe é avisado por sino e e-mail, sem o texto da mensagem.
        </p>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          rows={2}
          maxLength={MAX_COMENTARIO}
          placeholder="Escreva ao supervisor / à gestão…"
          className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
        />
        {erro && <p className="text-xs text-red-500">{erro}</p>}
        <div className="flex items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600" title="A outra parte é avisada, mas a ocorrência não fica pendente de resposta.">
            <input
              type="checkbox"
              checked={soInformar}
              onChange={e => setSoInformar(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Só informar (não precisa de resposta)
          </label>
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
