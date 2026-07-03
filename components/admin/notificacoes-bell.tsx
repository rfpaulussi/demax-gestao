'use client'

import { useState, useTransition } from 'react'
import { Bell, X, CheckCheck, AlertTriangle, FileText, UserMinus, Shield, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { marcarTodasLidas, excluirNotificacoesLidas, excluirNotificacaoIndividual } from '@/app/(admin)/notificacoes/actions'

export type LogAcao = {
  id: string
  created_at: string
  supervisor_nome: string
  tipo: string
  acao: string
  funcionario_nome: string | null
  detalhes: string | null
  lido: boolean
}

const TIPO_ICON: Record<string, React.ReactNode> = {
  atestado:   <FileText size={14} className="text-blue-500" />,
  falta:      <UserMinus size={14} className="text-amber-500" />,
  advertencia:<Shield size={14} className="text-red-500" />,
  cobertura:  <AlertTriangle size={14} className="text-orange-500" />,
}

const TIPO_LABEL: Record<string, string> = {
  atestado:    'Atestado',
  falta:       'Falta',
  advertencia: 'Advertência',
  cobertura:   'Cobertura',
}

const ACAO_LABEL: Record<string, string> = {
  criou:   'registrou',
  editou:  'editou',
  excluiu: 'excluiu',
}

function fmtRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 1)   return 'agora'
  if (min < 60)  return `${min}min atrás`
  const h = Math.floor(min / 60)
  if (h < 24)    return `${h}h atrás`
  const d = Math.floor(h / 24)
  return `${d}d atrás`
}

interface Props {
  unread: number
  logs: LogAcao[]
}

export function NotificacoesBell({ unread: initialUnread, logs: initialLogs }: Props) {
  const [open, setOpen]         = useState(false)
  const [unread, setUnread]     = useState(initialUnread)
  const [logs, setLogs]         = useState(initialLogs)
  const [pending, startTransition] = useTransition()

  function handleMarcarLidas() {
    startTransition(async () => {
      await marcarTodasLidas()
      setUnread(0)
      setLogs(logs.map(l => ({ ...l, lido: true })))
    })
  }

  function handleExcluirLidas() {
    startTransition(async () => {
      await excluirNotificacoesLidas()
      setLogs(logs.filter(l => !l.lido))
    })
  }

  function handleExcluirIndividual(id: string) {
    startTransition(async () => {
      await excluirNotificacaoIndividual(id)
      const removed = logs.find(l => l.id === id)
      setLogs(logs.filter(l => l.id !== id))
      if (removed && !removed.lido) setUnread(u => Math.max(0, u - 1))
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
        title="Notificações de supervisores"
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
          {/* Backdrop */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="absolute right-0 top-10 z-40 w-80 rounded-xl border border-gray-200 bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Ações de supervisores</p>
                {unread > 0 && (
                  <p className="text-xs text-gray-400">{unread} não {unread === 1 ? 'lida' : 'lidas'}</p>
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
                {logs.some(l => l.lido) && (
                  <button
                    type="button"
                    onClick={handleExcluirLidas}
                    disabled={pending}
                    title="Excluir mensagens lidas"
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                    Excluir lidas
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

            {/* Lista */}
            <div className="max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400">Sem ações recentes</p>
              ) : (
                logs.map(log => (
                  <div
                    key={log.id}
                    className={cn(
                      'flex gap-3 px-4 py-3 border-b border-gray-50 last:border-0',
                      !log.lido && 'bg-blue-50/60',
                    )}
                  >
                    <div className="mt-0.5 shrink-0">
                      {TIPO_ICON[log.tipo] ?? <Bell size={14} className="text-gray-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-700 leading-snug">
                        <span className="font-semibold text-gray-900">{log.supervisor_nome}</span>
                        {' '}{ACAO_LABEL[log.acao] ?? log.acao}{' '}
                        <span className="text-gray-500">{TIPO_LABEL[log.tipo] ?? log.tipo}</span>
                        {log.funcionario_nome && (
                          <> de <span className="font-medium">{log.funcionario_nome}</span></>
                        )}
                        {log.detalhes && (
                          <span className="text-gray-400"> ({log.detalhes})</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[10px] text-gray-400">{fmtRelativo(log.created_at)}</p>
                    </div>
                    {!log.lido ? (
                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    ) : (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); handleExcluirIndividual(log.id) }}
                        className="shrink-0 text-gray-300 hover:text-red-400 disabled:opacity-50"
                        disabled={pending}
                        title="Excluir notificação"
                      >
                        <X size={13} />
                      </button>
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
