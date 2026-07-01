'use client'

import { useState, useTransition } from 'react'
import { Bell, X, CheckCheck, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { marcarSolicitacoesLidasSupervisor } from '@/app/(admin)/notificacoes/actions'

export type SolicitacaoNotif = {
  id: string
  tipo: string
  status: string
  created_at: string | null
  observacao_admin: string | null
  lida_supervisor: boolean
  funcionario_nome: string | null
}

const TIPO_LABEL: Record<string, string> = {
  ferias:          'Férias',
  afastamento:     'Afastamento',
  cobertura:       'Cobertura',
  admissao:        'Admissão',
  desligamento:    'Desligamento',
  transferencia:   'Transferência',
  mudanca_funcao:  'Mudança de Função',
  promocao:        'Promoção',
}

function fmtRelativo(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 1)  return 'agora'
  if (min < 60) return `${min}min atrás`
  const h = Math.floor(min / 60)
  if (h < 24)   return `${h}h atrás`
  const d = Math.floor(h / 24)
  return `${d}d atrás`
}

interface Props {
  unread: number
  notifs: SolicitacaoNotif[]
}

export function SupervisorBell({ unread: initialUnread, notifs: initialNotifs }: Props) {
  const [open, setOpen]     = useState(false)
  const [unread, setUnread] = useState(initialUnread)
  const [notifs, setNotifs] = useState(initialNotifs)
  const [pending, startTransition] = useTransition()

  function handleMarcarLidas() {
    startTransition(async () => {
      await marcarSolicitacoesLidasSupervisor()
      setUnread(0)
      setNotifs(notifs.map(n => ({ ...n, lida_supervisor: true })))
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
          open ? 'bg-slate-100' : 'hover:bg-gray-100',
        )}
        title="Suas solicitações"
      >
        <Bell size={17} className={unread > 0 ? 'text-slate-700' : 'text-gray-400'} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-10 z-40 w-80 rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Suas solicitações</p>
                {unread > 0 && (
                  <p className="text-xs text-gray-400">{unread} nova{unread !== 1 ? 's' : ''}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={handleMarcarLidas}
                    disabled={pending}
                    title="Marcar todas como lidas"
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50"
                  >
                    <CheckCheck size={13} />
                    Lidas
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifs.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400">Sem notificações recentes</p>
              ) : (
                notifs.map(n => (
                  <div
                    key={n.id}
                    className={cn(
                      'flex gap-3 px-4 py-3 border-b border-gray-50 last:border-0',
                      !n.lida_supervisor && 'bg-blue-50/60',
                    )}
                  >
                    <div className="mt-0.5 shrink-0">
                      {n.status === 'aprovada'
                        ? <CheckCircle2 size={14} className="text-green-500" />
                        : n.status === 'rejeitada'
                          ? <XCircle size={14} className="text-red-500" />
                          : <Clock size={14} className="text-amber-500" />
                      }
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-700 leading-snug">
                        <span className="font-semibold text-gray-900">
                          {TIPO_LABEL[n.tipo] ?? n.tipo.replace(/_/g, ' ')}
                        </span>
                        {n.funcionario_nome && (
                          <> de <span className="font-medium">{n.funcionario_nome}</span></>
                        )}
                        {' — '}
                        <span className={n.status === 'aprovada' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                          {n.status === 'aprovada' ? 'Aprovada' : 'Rejeitada'}
                        </span>
                      </p>
                      {n.observacao_admin && (
                        <p className="mt-0.5 text-[10px] text-gray-400 italic">{n.observacao_admin}</p>
                      )}
                      <p className="mt-0.5 text-[10px] text-gray-400">{fmtRelativo(n.created_at)}</p>
                    </div>
                    {!n.lida_supervisor && (
                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
