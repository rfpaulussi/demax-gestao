'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { aprovarSolicitacao, rejeitarSolicitacao } from '@/app/(admin)/aprovacoes/actions'
import type { SolicitacaoRow } from '@/app/(admin)/aprovacoes/actions'
import type { TipoSolicitacao } from '@/types'

// ─── Tipos ────────────────────────────────────────────────────────────────────

// Re-export para compatibilidade com page.tsx legado
export type { SolicitacaoRow as SolicitacaoPendente }

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPO_BADGE: Record<TipoSolicitacao, { label: string; className: string }> = {
  desligamento:        { label: 'Desligamento',          className: 'bg-red-50 text-red-700 ring-red-200'          },
  transferencia:       { label: 'Transferência',         className: 'bg-blue-50 text-blue-700 ring-blue-200'       },
  mudanca_funcao:      { label: 'Mudança de Função',     className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  promocao:            { label: 'Promoção',              className: 'bg-green-50 text-green-700 ring-green-200'    },
  mudanca_supervisor:  { label: 'Mudança Supervisor',    className: 'bg-purple-50 text-purple-700 ring-purple-200' },
  alteracao_salario:   { label: 'Alteração Salarial',   className: 'bg-amber-50 text-amber-700 ring-amber-200'    },
  afastamento:         { label: 'Afastamento',           className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  retorno_afastamento: { label: 'Retorno Afastamento',  className: 'bg-teal-50 text-teal-700 ring-teal-200'       },
  rescisao_indireta:   { label: 'Rescisão Indireta',    className: 'bg-rose-50 text-rose-700 ring-rose-200'       },
}

const TIPO_LABEL_FILTRO: Record<TipoSolicitacao, string> = {
  desligamento:        'Desligamento',
  transferencia:       'Transferência',
  mudanca_funcao:      'Mudança de Função',
  promocao:            'Promoção',
  mudanca_supervisor:  'Mudança Supervisor',
  alteracao_salario:   'Alteração Salarial',
  afastamento:         'Afastamento',
  retorno_afastamento: 'Retorno Afastamento',
  rescisao_indireta:   'Rescisão Indireta',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

const CAMPO_LABELS: Record<string, string> = {
  nome:                  'Nome',
  status:                'Status',
  posto:                 'Posto',
  funcao:                'Função',
  salario:               'Salário',
  novo_salario:          'Novo salário',
  data_desligamento:     'Data desligamento',
  motivo:                'Motivo',
  data_inicio:           'Data início',
  data_retorno_prevista: 'Retorno previsto',
  data_retorno:          'Data retorno',
  data_rescisao:         'Data rescisão',
}

function renderDados(
  dados: Record<string, unknown> | null,
  label: string,
  side: 'antes' | 'depois',
) {
  if (!dados) return <p className="text-xs italic text-gray-400">—</p>
  const bg   = side === 'antes' ? 'bg-gray-50'  : 'bg-green-50'
  const text = side === 'antes' ? 'text-gray-400' : 'text-green-600'
  const entries = Object.entries(dados).filter(([k]) => !k.endsWith('_id'))

  return (
    <div className={cn('rounded-lg border border-gray-100 p-3 text-xs', bg)}>
      <p className={cn('mb-2 font-semibold uppercase tracking-widest text-xs', text)}>
        {label}
      </p>
      {entries.length === 0 ? (
        <p className="italic text-gray-400">sem dados</p>
      ) : (
        <dl className="space-y-1">
          {entries.map(([k, v]) => (
            <div key={k} className="flex gap-1">
              <dt className="font-medium text-gray-500 shrink-0">
                {CAMPO_LABELS[k] ?? k.replace(/_/g, ' ')}:
              </dt>
              <dd className="text-gray-800 break-words">{String(v ?? '—')}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

// ─── SolicitacaoCard ──────────────────────────────────────────────────────────

function SolicitacaoCard({ sol }: { sol: SolicitacaoRow }) {
  const [isPending, startTransition] = useTransition()
  const [fase, setFase]               = useState<'idle' | 'aprovando' | 'rejeitando'>('idle')
  const [observacao, setObservacao]   = useState('')
  const [motivo, setMotivo]           = useState('')
  const [erro, setErro]               = useState<string | null>(null)
  const [ok, setOk]                   = useState(false)

  const badge = TIPO_BADGE[sol.tipo]

  function handleAprovar() {
    setErro(null)
    startTransition(async () => {
      const result = await aprovarSolicitacao(sol.id, observacao || undefined)
      if (!result.success) { setErro(result.error); return }
      setOk(true)
    })
  }

  function handleRejeitar() {
    if (!motivo.trim()) return
    setErro(null)
    startTransition(async () => {
      const result = await rejeitarSolicitacao(sol.id, motivo)
      if (!result.success) { setErro(result.error); return }
      setOk(true)
    })
  }

  if (ok) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm opacity-60">
        <p className="text-sm font-medium text-gray-400">
          {fase === 'rejeitando' ? 'Solicitação rejeitada.' : 'Solicitação aprovada.'}
        </p>
      </div>
    )
  }

  return (
    <div className={cn(
      'rounded-xl border border-gray-100 bg-white shadow-sm transition-opacity',
      isPending && 'opacity-60 pointer-events-none',
    )}>
      {/* Header do card */}
      <div className="border-b border-gray-50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
              badge.className,
            )}>
              {badge.label}
            </span>
            <p className="text-sm font-semibold text-gray-900">
              {sol.funcionarios?.nome ?? '—'}
              {sol.funcionarios?.cpf && (
                <span className="ml-2 font-normal text-gray-400">***.***.***-**</span>
              )}
            </p>
            <p className="text-xs text-gray-400">
              Por{' '}
              <span className="font-medium text-gray-600">
                {sol.perfis?.nome ?? sol.perfis?.email ?? 'supervisor'}
              </span>
              {sol.created_at && (
                <span className="ml-1.5 text-gray-300">· {fmt(sol.created_at)}</span>
              )}
            </p>
            {sol.motivo && (
              <p className="text-xs text-gray-500 italic">&ldquo;{sol.motivo}&rdquo;</p>
            )}
          </div>
        </div>
      </div>

      {/* Dados antes / depois */}
      <div className="grid grid-cols-2 gap-3 p-5">
        {renderDados(sol.dados_antes,  'Situação atual', 'antes')}
        {renderDados(sol.dados_depois, 'Solicitado',     'depois')}
      </div>

      {/* Erro */}
      {erro && (
        <div className="mx-5 mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </div>
      )}

      {/* Ações */}
      <div className="border-t border-gray-50 p-5">
        {fase === 'idle' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFase('aprovando')}
              disabled={isPending}
              className="rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              Aprovar
            </button>
            <button
              onClick={() => setFase('rejeitando')}
              disabled={isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              Rejeitar
            </button>
          </div>
        )}

        {fase === 'aprovando' && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Observação (opcional)
            </p>
            <textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              rows={2}
              placeholder="Adicione uma observação ao aprovar..."
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setFase('idle'); setObservacao('') }}
                className="rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gray-600 hover:bg-gray-100"
              >
                Voltar
              </button>
              <button
                onClick={handleAprovar}
                disabled={isPending}
                className="rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isPending ? 'Processando...' : 'Confirmar Aprovação'}
              </button>
            </div>
          </div>
        )}

        {fase === 'rejeitando' && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Motivo da rejeição <span className="normal-case font-normal text-red-500">(obrigatório)</span>
            </p>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={2}
              placeholder="Informe o motivo..."
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setFase('idle'); setMotivo('') }}
                className="rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gray-600 hover:bg-gray-100"
              >
                Voltar
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
        )}
      </div>
    </div>
  )
}

// ─── AprovacoesList ───────────────────────────────────────────────────────────

export function AprovacoesList({ solicitacoes }: { solicitacoes: SolicitacaoRow[] }) {
  const [filtroTipo, setFiltroTipo] = useState<TipoSolicitacao | null>(null)

  // Tipos presentes no dataset
  const tiposPresentes = Array.from(new Set(solicitacoes.map(s => s.tipo))) as TipoSolicitacao[]

  const filtradas = filtroTipo
    ? solicitacoes.filter(s => s.tipo === filtroTipo)
    : solicitacoes

  return (
    <div className="space-y-4">

      {/* Filtros por tipo */}
      {tiposPresentes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFiltroTipo(null)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
              filtroTipo === null
                ? 'bg-slate-900 text-white'
                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
            )}
          >
            Todos ({solicitacoes.length})
          </button>
          {tiposPresentes.map(tipo => (
            <button
              key={tipo}
              onClick={() => setFiltroTipo(filtroTipo === tipo ? null : tipo)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                filtroTipo === tipo
                  ? 'bg-slate-900 text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
              )}
            >
              {TIPO_LABEL_FILTRO[tipo]} ({solicitacoes.filter(s => s.tipo === tipo).length})
            </button>
          ))}
        </div>
      )}

      {/* Cards */}
      {filtradas.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-sm font-medium text-gray-400">
            {filtroTipo
              ? `Nenhuma solicitação pendente de ${TIPO_LABEL_FILTRO[filtroTipo]}.`
              : 'Nenhuma solicitação pendente.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtradas.map(sol => (
            <SolicitacaoCard key={sol.id} sol={sol} />
          ))}
        </div>
      )}
    </div>
  )
}
