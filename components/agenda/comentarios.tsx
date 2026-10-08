'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MessagesSquare } from 'lucide-react'
import { comentarAgenda } from '@/app/(admin)/agenda/actions'
import type { ComentarioView } from '@/app/(admin)/agenda/actions'

const ROTULO: Record<string, string> = { admin: 'Admin', coordenador: 'Coordenação', supervisor: 'Supervisor' }

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}

function quando(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

export function Comentarios({
  itens,
  supervisorId,
  semanaInicio,
  temSemana,
}: {
  itens: ComentarioView[]
  supervisorId: string
  semanaInicio: string
  temSemana: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  function enviar() {
    setErro(null)
    start(async () => {
      const r = await comentarAgenda({ supervisorId, semanaInicio, texto })
      if (!r.ok) return setErro(r.erro)
      setTexto('')
      router.refresh()
    })
  }

  return (
    <div className="rounded-2xl border border-slate-200 border-t-4 border-t-indigo-500 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <MessagesSquare className="h-4 w-4 text-indigo-500" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Linha do tempo</h2>
      </div>

      {itens.length === 0 ? (
        <p className="mb-3 text-sm text-slate-400">Sem registros ainda.</p>
      ) : (
        <ul className="mb-3 max-h-80 space-y-2.5 overflow-y-auto pr-1">
          {itens.map(c => {
            const sistema = /^(🔄|🗑️|📢)/.test(c.texto)
            if (sistema) {
              return (
                <li key={c.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {c.texto}
                  <span className="ml-1 text-[10px] text-slate-400">· {quando(c.created_at)}</span>
                </li>
              )
            }
            return (
              <li key={c.id} className="flex gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-[11px] font-bold text-white">
                  {iniciais(c.autor_nome)}
                </span>
                <div className="min-w-0 flex-1 rounded-xl rounded-tl-none bg-indigo-50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-indigo-900">
                    {c.autor_nome} <span className="font-normal text-indigo-400">· {ROTULO[c.autor_role] ?? c.autor_role} · {quando(c.created_at)}</span>
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-slate-800">{c.texto}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {temSemana ? (
        <div className="space-y-2">
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Escreva um comentário…"
            className="w-full resize-none rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-slate-400"
          />
          {erro && <p className="text-xs font-medium text-red-600">{erro}</p>}
          <button
            type="button" onClick={enviar} disabled={pending || !texto.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
          >
            {pending ? 'Enviando…' : 'Comentar'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-400">Comentários ficam disponíveis quando o supervisor iniciar a agenda.</p>
      )}
    </div>
  )
}
