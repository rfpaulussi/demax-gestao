'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { aprovarSolicitacao, rejeitarSolicitacao } from '@/app/(admin)/aprovacoes/actions'
import type { TipoSolicitacao } from '@/types'

// ─── types ────────────────────────────────────────────────────────────────────

export type SolicitacaoPendente = {
  id: string
  tipo: TipoSolicitacao
  motivo: string | null
  dados_antes: Record<string, unknown> | null
  dados_depois: Record<string, unknown> | null
  created_at: string | null
  funcionarios: { nome: string; cpf: string | null } | null
  perfis: { nome: string | null; email: string | null } | null
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

const TIPO_BADGE: Record<TipoSolicitacao, { label: string; className: string }> = {
  desligamento:       { label: 'Desligamento',      className: 'bg-red-50 text-red-700 ring-red-200'         },
  transferencia:      { label: 'Transferência',      className: 'bg-blue-50 text-blue-700 ring-blue-200'       },
  mudanca_funcao:     { label: 'Mudança de Função',  className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  promocao:           { label: 'Promoção',           className: 'bg-green-50 text-green-700 ring-green-200'    },
  mudanca_supervisor:  { label: 'Mudança Supervisor',  className: 'bg-purple-50 text-purple-700 ring-purple-200'   },
  alteracao_salario:   { label: 'Alteração Salarial',  className: 'bg-amber-50 text-amber-700 ring-amber-200'     },
  afastamento:         { label: 'Afastamento',         className: 'bg-orange-50 text-orange-700 ring-orange-200'  },
  retorno_afastamento: { label: 'Retorno Afastamento', className: 'bg-teal-50 text-teal-700 ring-teal-200'        },
  rescisao_indireta:   { label: 'Rescisão Indireta',   className: 'bg-rose-50 text-rose-700 ring-rose-200'        },
  admissao:            { label: 'Admissão',            className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
}

function renderDados(dados: Record<string, unknown> | null, label: string, side: 'antes' | 'depois') {
  if (!dados) return <p className="text-xs text-gray-400 italic">—</p>
  const bg = side === 'antes' ? 'bg-gray-50' : 'bg-green-50'
  const entries = Object.entries(dados).filter(([k]) => !k.endsWith('_id'))
  return (
    <div className={cn('rounded p-2 text-xs', bg)}>
      <p className="mb-1 font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      {entries.length === 0 ? (
        <p className="text-gray-400 italic">sem dados</p>
      ) : (
        entries.map(([k, v]) => (
          <p key={k} className="text-gray-700">
            <span className="font-medium">{k.replace(/_/g, ' ')}:</span>{' '}
            {String(v ?? '—')}
          </p>
        ))
      )}
    </div>
  )
}

// ─── card ─────────────────────────────────────────────────────────────────────

function SolicitacaoCard({ sol, canApprove }: { sol: SolicitacaoPendente; canApprove: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [rejeitando, setRejeitando] = useState(false)
  const [motivo, setMotivo] = useState('')

  const badge = TIPO_BADGE[sol.tipo]

  function handleAprovar() {
    startTransition(async () => {
      await aprovarSolicitacao(sol.id)
    })
  }

  function handleRejeitar() {
    if (!motivo.trim()) return
    startTransition(async () => {
      await rejeitarSolicitacao(sol.id, motivo)
      setRejeitando(false)
      setMotivo('')
    })
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', badge.className)}>
            {badge.label}
          </span>
          <p className="mt-2 text-sm font-semibold text-gray-900">
            {sol.funcionarios?.nome ?? '—'}
            <span className="ml-2 font-normal text-gray-400">
              {sol.funcionarios?.cpf ? '***.***.***-**' : ''}
            </span>
          </p>
          <p className="text-xs text-gray-400">
            Solicitado por {sol.perfis?.nome ?? sol.perfis?.email ?? 'supervisor'}{' '}
            {sol.created_at ? `· ${fmt(sol.created_at)}` : ''}
          </p>
          {sol.motivo && (
            <p className="mt-1 text-xs text-gray-500">Motivo: {sol.motivo}</p>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        {renderDados(sol.dados_antes, 'Situação atual', 'antes')}
        {renderDados(sol.dados_depois, 'Solicitado', 'depois')}
      </div>

      {canApprove && (!rejeitando ? (
        <div className="flex items-center gap-2">
          <button
            onClick={handleAprovar}
            disabled={isPending}
            className="rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {isPending ? 'Processando...' : 'Aprovar'}
          </button>
          <button
            onClick={() => setRejeitando(true)}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            Rejeitar
          </button>
        </div>
      ) : (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Motivo da rejeição (obrigatório)
          </p>
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            rows={2}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600"
            placeholder="Informe o motivo..."
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setRejeitando(false); setMotivo('') }}
              className="rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={handleRejeitar}
              disabled={!motivo.trim() || isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? 'Processando...' : 'Confirmar Rejeição'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── lista principal ──────────────────────────────────────────────────────────

export function AprovacoesList({ solicitacoes, canApprove = true }: { solicitacoes: SolicitacaoPendente[]; canApprove?: boolean }) {
  if (solicitacoes.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white px-6 py-12 text-center shadow-sm">
        <p className="text-sm font-medium text-gray-400">Nenhuma solicitação encontrada.</p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {solicitacoes.map(sol => (
        <SolicitacaoCard key={sol.id} sol={sol} canApprove={canApprove} />
      ))}
    </div>
  )
}
