'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { aprovarSolicitacao, rejeitarSolicitacao } from '@/app/(admin)/aprovacoes/actions'
import type { SolicitacaoRow } from '@/app/(admin)/aprovacoes/actions'
import type { TipoSolicitacao } from '@/types'

export type { SolicitacaoRow as SolicitacaoPendente }

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPO_BADGE: Record<TipoSolicitacao, { label: string; className: string }> = {
  desligamento:        { label: 'Desligamento',         className: 'bg-red-50 text-red-700 ring-red-200'          },
  transferencia:       { label: 'Transferência',         className: 'bg-blue-50 text-blue-700 ring-blue-200'       },
  mudanca_funcao:      { label: 'Mudança de Função',     className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  promocao:            { label: 'Promoção',              className: 'bg-green-50 text-green-700 ring-green-200'    },
  mudanca_supervisor:  { label: 'Mudança Supervisor',    className: 'bg-purple-50 text-purple-700 ring-purple-200' },
  alteracao_salario:   { label: 'Alteração Salarial',    className: 'bg-amber-50 text-amber-700 ring-amber-200'   },
  afastamento:         { label: 'Afastamento',           className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  retorno_afastamento: { label: 'Retorno Afastamento',   className: 'bg-teal-50 text-teal-700 ring-teal-200'      },
  rescisao_indireta:   { label: 'Rescisão Indireta',     className: 'bg-rose-50 text-rose-700 ring-rose-200'      },
}

const BORDER_COLOR: Record<TipoSolicitacao, string> = {
  desligamento:        'border-l-red-500',
  transferencia:       'border-l-blue-500',
  mudanca_funcao:      'border-l-indigo-500',
  promocao:            'border-l-green-500',
  mudanca_supervisor:  'border-l-purple-500',
  alteracao_salario:   'border-l-amber-500',
  afastamento:         'border-l-orange-500',
  retorno_afastamento: 'border-l-teal-500',
  rescisao_indireta:   'border-l-rose-500',
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

const CAMPO_LABELS: Record<string, string> = {
  nome:                  'Nome',
  status:                'Status',
  posto:                 'Posto',
  funcao:                'Função',
  salario:               'Salário',
  novo_salario:          'Novo salário',
  data_desligamento:     'Data desligamento',
  motivo:                'Motivo',
  data_inicio:           'Início',
  data_retorno_prevista: 'Retorno previsto',
  data_retorno:          'Data retorno',
  data_rescisao:         'Data rescisão',
  posto_destino_nome:    'Posto destino',
  funcao_destino_nome:   'Função destino',
  novo_supervisor_nome:  'Novo supervisor',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function renderDadosSolicitado(dados: Record<string, unknown> | null) {
  if (!dados) return <span className="text-gray-400 italic">—</span>
  const entries = Object.entries(dados).filter(
    ([k]) => !k.endsWith('_id') && !k.endsWith('_nome') === false
      ? !k.endsWith('_id')
      : true,
  ).filter(([k]) => !k.endsWith('_id'))

  if (entries.length === 0) return <span className="text-gray-400 italic">sem dados</span>

  return (
    <span>
      {entries.map(([k, v], i) => (
        <span key={k}>
          {i > 0 && <span className="mx-1.5 text-green-300">·</span>}
          <span className="text-green-700 font-medium">
            {CAMPO_LABELS[k] ?? k.replace(/_/g, ' ')}:
          </span>{' '}
          <span className="text-green-900">{String(v ?? '—')}</span>
        </span>
      ))}
    </span>
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

  const badge       = TIPO_BADGE[sol.tipo]
  const borderColor = BORDER_COLOR[sol.tipo]

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
      <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm opacity-0 transition-opacity duration-500">
        <p className="text-xs text-gray-400">Processado.</p>
      </div>
    )
  }

  return (
    <div className={cn(
      'rounded-lg border border-gray-100 border-l-4 bg-white shadow-sm transition-opacity',
      borderColor,
      isPending && 'opacity-60 pointer-events-none',
    )}>
      {/* Header compacto */}
      <div className="px-4 pt-3 pb-2">
        {/* Linha 1: badge + nome + data */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn(
              'shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
              badge.className,
            )}>
              {badge.label}
            </span>
            <span className="text-sm font-semibold text-gray-900 truncate">
              {sol.funcionarios?.nome ?? '—'}
            </span>
          </div>
          {sol.created_at && (
            <span className="shrink-0 text-xs text-gray-400">{fmt(sol.created_at)}</span>
          )}
        </div>

        {/* Linha 2: supervisor */}
        <p className="mt-0.5 text-xs text-gray-400">
          Por{' '}
          <span className="font-medium text-gray-500">
            {sol.perfis?.nome ?? sol.perfis?.email ?? 'supervisor'}
          </span>
        </p>
      </div>

      {/* Dados solicitados — faixa verde compacta */}
      {sol.dados_depois && Object.keys(sol.dados_depois).filter(k => !k.endsWith('_id')).length > 0 && (
        <div className="mx-4 mb-2 rounded bg-green-50 px-3 py-1.5 text-xs leading-relaxed">
          {renderDadosSolicitado(sol.dados_depois)}
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div className="mx-4 mb-2 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {erro}
        </div>
      )}

      {/* Ações */}
      <div className="border-t border-gray-50 px-4 py-2">
        {fase === 'idle' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFase('aprovando')}
              disabled={isPending}
              className="rounded px-3 py-1 text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              ✓ Aprovar
            </button>
            <button
              onClick={() => setFase('rejeitando')}
              disabled={isPending}
              className="rounded px-3 py-1 text-xs font-semibold border border-red-400 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              ✗ Rejeitar
            </button>
          </div>
        )}

        {fase === 'aprovando' && (
          <div className="space-y-2">
            <textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              rows={2}
              placeholder="Observação (opcional)..."
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setFase('idle'); setObservacao('') }}
                className="rounded px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleAprovar}
                disabled={isPending}
                className="rounded px-3 py-1 text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isPending ? 'Processando...' : 'Confirmar Aprovação'}
              </button>
            </div>
          </div>
        )}

        {fase === 'rejeitando' && (
          <div className="space-y-2">
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={2}
              placeholder="Motivo da rejeição (obrigatório)..."
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setFase('idle'); setMotivo('') }}
                className="rounded px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleRejeitar}
                disabled={!motivo.trim() || isPending}
                className="rounded px-3 py-1 text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
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
        <div className="grid grid-cols-1 gap-3">
          {filtradas.map(sol => (
            <SolicitacaoCard key={sol.id} sol={sol} />
          ))}
        </div>
      )}
    </div>
  )
}
