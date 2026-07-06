'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { aprovarSolicitacao, rejeitarSolicitacao } from '@/app/(admin)/aprovacoes/actions'
import { PostoImpactPanel } from '@/components/posto-impact-panel'
import type { ImpactoResult } from '@/app/(admin)/efetivo/impacto'
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

function renderInline(dados: Record<string, unknown> | null): string {
  if (!dados) return '—'
  return Object.entries(dados)
    .filter(([k]) => !k.endsWith('_id'))
    .map(([, v]) => String(v ?? '—'))
    .join(' / ')
}

// ─── card ─────────────────────────────────────────────────────────────────────

function SolicitacaoCard({ sol, canApprove, impacto }: { sol: SolicitacaoPendente; canApprove: boolean; impacto?: ImpactoResult }) {
  const [isPending, startTransition] = useTransition()
  const [rejeitando, setRejeitando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const router = useRouter()

  const isTransfComFuncao = sol.tipo === 'transferencia' && !!sol.dados_depois?.nova_funcao_id
  const badge = isTransfComFuncao
    ? { label: 'Transferência + Função', className: 'bg-amber-50 text-amber-700 ring-amber-200' }
    : TIPO_BADGE[sol.tipo]

  function handleAprovar() {
    setErro(null)
    startTransition(async () => {
      const result = await aprovarSolicitacao(sol.id)
      if (!result.success) { setErro(result.error); return }
      if (result.redirect_url) router.push(result.redirect_url)
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
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      {/* Header compacto */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', badge.className)}>
          {badge.label}
        </span>
        <span className="shrink-0 text-[10px] text-gray-400">
          {sol.created_at ? fmt(sol.created_at) : ''}
        </span>
      </div>

      {/* Funcionário */}
      <p className="mb-0.5 text-sm font-semibold text-gray-900 leading-tight">
        {sol.funcionarios?.nome ?? '—'}
      </p>

      {/* Solicitante + motivo */}
      <p className="mb-2 text-xs text-gray-500">
        <span className="font-medium text-slate-700">{sol.perfis?.nome ?? sol.perfis?.email ?? 'supervisor'}</span>
        {sol.motivo ? ` · ${sol.motivo}` : ''}
      </p>

      {/* Antes → Depois inline */}
      <div className="mb-2 flex items-center gap-1.5 flex-wrap">
        <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
          {renderInline(sol.dados_antes)}
        </span>
        <span className="text-xs text-gray-400">→</span>
        <span className="rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
          {renderInline(sol.dados_depois)}
        </span>
      </div>

      {/* Impacto nos postos */}
      {impacto && (
        <div className="mb-3">
          <PostoImpactPanel impacto={impacto} />
        </div>
      )}

      {erro && (
        <p className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600">{erro}</p>
      )}

      {canApprove && (!rejeitando ? (
        <div className="flex gap-2">
          <button
            onClick={handleAprovar}
            disabled={isPending}
            className="flex-1 rounded-lg bg-green-600 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {isPending ? '...' : 'Aprovar'}
          </button>
          <button
            onClick={() => setRejeitando(true)}
            disabled={isPending}
            className="flex-1 rounded-lg border border-red-300 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            Rejeitar
          </button>
        </div>
      ) : (
        <div className="space-y-1.5 border-t border-gray-100 pt-2">
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            rows={2}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-600"
            placeholder="Motivo da rejeição..."
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setRejeitando(false); setMotivo('') }}
              className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleRejeitar}
              disabled={!motivo.trim() || isPending}
              className="flex-1 rounded-lg bg-red-600 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? '...' : 'Confirmar'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── lista principal ──────────────────────────────────────────────────────────

const TIPO_ORDEM: TipoSolicitacao[] = [
  'transferencia', 'mudanca_funcao', 'desligamento', 'rescisao_indireta',
  'promocao', 'mudanca_supervisor', 'alteracao_salario', 'afastamento',
  'retorno_afastamento', 'admissao',
]

export function AprovacoesList({ solicitacoes, canApprove = true, impactos = {} }: { solicitacoes: SolicitacaoPendente[]; canApprove?: boolean; impactos?: Record<string, ImpactoResult> }) {
  if (solicitacoes.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white px-6 py-12 text-center shadow-sm">
        <p className="text-sm font-medium text-gray-400">Nenhuma solicitação encontrada.</p>
      </div>
    )
  }

  const porTipo = solicitacoes.reduce<Record<string, SolicitacaoPendente[]>>((acc, s) => {
    acc[s.tipo] = acc[s.tipo] ?? []
    acc[s.tipo].push(s)
    return acc
  }, {})

  const tiposOrdenados = TIPO_ORDEM.filter(t => porTipo[t])

  return (
    <div className="space-y-6">
      {tiposOrdenados.map(tipo => (
        <div key={tipo}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
            {TIPO_BADGE[tipo]?.label ?? tipo} ({porTipo[tipo].length})
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {porTipo[tipo].map(sol => (
              <SolicitacaoCard key={sol.id} sol={sol} canApprove={canApprove} impacto={impactos[sol.id]} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
