'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { aprovarSolicitacao, rejeitarSolicitacao } from '@/app/(admin)/aprovacoes/actions'
import type { SolicitacaoRow } from '@/app/(admin)/aprovacoes/actions'
import type { TipoSolicitacao } from '@/types'
import { TIPOS_DESLIGAMENTO, MOTIVOS_POR_TIPO } from '@/components/efetivo/modal-desligar'

const TIPO_DESLIG_MAP = Object.fromEntries(TIPOS_DESLIGAMENTO.map(t => [t.value, t.label]))
const TODOS_MOTIVOS_DESLIG = Object.fromEntries(
  Object.values(MOTIVOS_POR_TIPO).flat().map(m => [m.value, m.label])
)

export type { SolicitacaoRow as SolicitacaoPendente }

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPO_LABEL_COLOR: Record<TipoSolicitacao, string> = {
  desligamento:        'text-red-600',
  transferencia:       'text-blue-600',
  mudanca_funcao:      'text-indigo-600',
  promocao:            'text-green-600',
  mudanca_supervisor:  'text-purple-600',
  alteracao_salario:   'text-amber-600',
  afastamento:         'text-orange-600',
  retorno_afastamento: 'text-teal-600',
  rescisao_indireta:   'text-rose-600',
  admissao:            'text-emerald-600',
}

const TIPO_BADGE: Record<TipoSolicitacao, { label: string; className: string }> = {
  desligamento:        { label: 'Desligamento',        className: 'bg-red-50 text-red-700 ring-red-200'           },
  transferencia:       { label: 'Transferência',        className: 'bg-blue-50 text-blue-700 ring-blue-200'        },
  mudanca_funcao:      { label: 'Mudança de Função',    className: 'bg-indigo-50 text-indigo-700 ring-indigo-200'  },
  promocao:            { label: 'Promoção',             className: 'bg-green-50 text-green-700 ring-green-200'     },
  mudanca_supervisor:  { label: 'Mudança Supervisor',   className: 'bg-purple-50 text-purple-700 ring-purple-200'  },
  alteracao_salario:   { label: 'Alteração Salarial',   className: 'bg-amber-50 text-amber-700 ring-amber-200'     },
  afastamento:         { label: 'Afastamento',          className: 'bg-orange-50 text-orange-700 ring-orange-200'  },
  retorno_afastamento: { label: 'Retorno Afastamento',  className: 'bg-teal-50 text-teal-700 ring-teal-200'        },
  rescisao_indireta:   { label: 'Rescisão Indireta',    className: 'bg-rose-50 text-rose-700 ring-rose-200'        },
  admissao:            { label: 'Admissão',             className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
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
  admissao:            'border-l-emerald-500',
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
  admissao:            'Admissão',
}

const CAMPO_LABELS: Record<string, string> = {
  nome:                  'Nome',
  status:                'Status',
  posto:                 'Posto',
  funcao:                'Função',
  salario:               'Salário',
  novo_salario:          'Novo salário',
  data_desligamento:     'Data desligamento',
  tipo_desligamento:     'Tipo de desligamento',
  motivo:                'Motivo',
  data_inicio:           'Início',
  data_retorno_prevista: 'Retorno previsto',
  data_retorno:          'Data retorno',
  data_rescisao:         'Data rescisão',
  posto_destino_nome:    'Posto destino',
  funcao_destino_nome:   'Função destino',
  supervisor_nome:       'Supervisor atual',
  novo_supervisor_nome:  'Novo supervisor',
  funcao_nome:           'Função',
  posto_nome:            'Posto',
  secretaria:            'Secretaria',
  data_admissao:         'Data de admissão',
}

const STATUS_LABELS: Record<string, string> = {
  ativo:     'Ativo',
  afastado:  'Afastado',
  ferias:    'Férias',
  desligado: 'Desligado',
}

const MOTIVO_AFASTAMENTO_LABELS: Record<string, string> = {
  ausencia_temporaria: 'Ausência Temporária',
  inss:                'INSS',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function fmtVal(v: unknown): string {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return fmt(v)
  return String(v ?? '—')
}

function fmtValComContexto(tipo: TipoSolicitacao, campo: string, v: unknown): string {
  if (campo === 'status' && typeof v === 'string') {
    return STATUS_LABELS[v] ?? v
  }
  if (tipo === 'afastamento' && campo === 'motivo' && typeof v === 'string') {
    return MOTIVO_AFASTAMENTO_LABELS[v] ?? v
  }
  if (campo === 'tipo_desligamento' && typeof v === 'string') {
    return TIPO_DESLIG_MAP[v] ?? v
  }
  if (tipo === 'desligamento' && campo === 'motivo' && typeof v === 'string') {
    return TODOS_MOTIVOS_DESLIG[v] ?? v
  }
  return fmtVal(v)
}

function getNome(sol: SolicitacaoRow): string {
  if (sol.tipo === 'admissao') {
    return (sol.dados_depois as { nome?: string } | null)?.nome ?? '(sem nome)'
  }
  return sol.funcionarios?.nome ?? '—'
}

function renderColunaAntes(tipo: TipoSolicitacao, dados: Record<string, unknown> | null) {
  if (!dados) return <span className="text-gray-400 italic text-xs">—</span>
  const entries = Object.entries(dados).filter(([k]) => !k.endsWith('_id'))
  if (entries.length === 0) return <span className="text-gray-400 italic text-xs">—</span>
  return (
    <dl className="space-y-0.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-1 text-xs">
          <dt className="text-gray-400 shrink-0">{CAMPO_LABELS[k] ?? k.replace(/_/g, ' ')}:</dt>
          <dd className="text-gray-600 break-words">{fmtValComContexto(tipo, k, v)}</dd>
        </div>
      ))}
    </dl>
  )
}

function renderColunaDepois(tipo: TipoSolicitacao, dados: Record<string, unknown> | null) {
  if (!dados) return <span className="text-gray-400 italic text-xs">—</span>
  const entries = Object.entries(dados).filter(([k]) => !k.endsWith('_id'))
  if (entries.length === 0) return <span className="text-gray-400 italic text-xs">—</span>
  return (
    <dl className="space-y-0.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-1 text-xs">
          <dt className="text-gray-500 shrink-0">{CAMPO_LABELS[k] ?? k.replace(/_/g, ' ')}:</dt>
          <dd className="font-medium text-gray-800 break-words">{fmtValComContexto(tipo, k, v)}</dd>
        </div>
      ))}
    </dl>
  )
}

// ─── SolicitacaoCard ──────────────────────────────────────────────────────────

function SolicitacaoCard({ sol }: { sol: SolicitacaoRow }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [fase, setFase]               = useState<'idle' | 'aprovando' | 'rejeitando'>('idle')
  const [observacao, setObservacao]   = useState('')
  const [motivo, setMotivo]           = useState('')
  const [erro, setErro]               = useState<string | null>(null)
  const [ok, setOk]                   = useState(false)

  const badge       = TIPO_BADGE[sol.tipo]
  const borderColor = BORDER_COLOR[sol.tipo]
  const labelColor  = TIPO_LABEL_COLOR[sol.tipo]
  const isAdmissao  = sol.tipo === 'admissao'

  function handleAprovar() {
    setErro(null)
    startTransition(async () => {
      const result = await aprovarSolicitacao(sol.id, observacao || undefined)
      if (!result.success) { setErro(result.error); return }
      if (result.redirect_url) {
        router.push(result.redirect_url)
        return
      }
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
      <div className={cn(
        'flex flex-col rounded-xl border border-gray-100 border-l-4 bg-white shadow-sm opacity-50',
        borderColor,
      )}>
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-gray-400">
          {fase === 'rejeitando'
            ? <span className="text-2xl">✗</span>
            : <span className="text-2xl">✓</span>}
          <p className="mt-1 text-xs font-medium">
            {fase === 'rejeitando' ? 'Rejeitada' : 'Aprovada'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      'flex flex-col rounded-xl border border-gray-100 border-l-4 bg-white shadow-sm transition-opacity',
      borderColor,
      isPending && 'opacity-60 pointer-events-none',
    )}>

      {/* HEADER */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn(
              'shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
              badge.className,
            )}>
              {badge.label}
            </span>
            <span className="text-sm font-semibold text-gray-900 truncate">
              {getNome(sol)}
            </span>
          </div>
          {sol.created_at && (
            <span className="shrink-0 text-xs text-gray-400">{fmt(sol.created_at)}</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-400">
          Por{' '}
          <span className="font-medium text-gray-500">
            {sol.perfis?.nome ?? sol.perfis?.email ?? 'supervisor'}
          </span>
        </p>
      </div>

      {/* CORPO */}
      {isAdmissao ? (
        // Admissão: layout de coluna única (sem "Situação atual")
        <div className="flex-1 bg-gray-50/50 px-3 py-2">
          <p className={cn('mb-1 text-[10px] font-bold uppercase tracking-widest', labelColor)}>
            Dados para admissão
          </p>
          {renderColunaDepois(sol.tipo, sol.dados_depois)}
        </div>
      ) : (
        // Outros tipos: layout de duas colunas
        <div className="flex-1 grid grid-cols-2 divide-x divide-gray-200 bg-gray-50/50">
          <div className="px-3 py-2">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Situação atual
            </p>
            {renderColunaAntes(sol.tipo, sol.dados_antes)}
          </div>
          <div className="px-3 py-2">
            <p className={cn('mb-1 text-[10px] font-bold uppercase tracking-widest', labelColor)}>
              Solicitado
            </p>
            {renderColunaDepois(sol.tipo, sol.dados_depois)}
          </div>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div className="mx-3 mt-2 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {erro}
        </div>
      )}

      {/* RODAPÉ */}
      <div className="border-t border-gray-100 px-3 pb-3 pt-2">
        {fase === 'idle' && (
          <div className="flex gap-2">
            <button
              onClick={() => setFase('aprovando')}
              disabled={isPending}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              ✓ Aprovar
            </button>
            <button
              onClick={() => setFase('rejeitando')}
              disabled={isPending}
              className="rounded-lg border border-red-400 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
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
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleAprovar}
                disabled={isPending}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {isPending ? 'Processando...' : isAdmissao ? 'Criar funcionário' : 'Confirmar Aprovação'}
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
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleRejeitar}
                disabled={!motivo.trim() || isPending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
          {filtradas.map(sol => (
            <SolicitacaoCard key={sol.id} sol={sol} />
          ))}
        </div>
      )}
    </div>
  )
}
