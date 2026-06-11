'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { SolicitacaoRow } from '@/app/(admin)/aprovacoes/actions'
import type { TipoSolicitacao } from '@/types'

type StatusFilter = 'todas' | 'pendente' | 'aprovada' | 'rejeitada'

const TIPO_BADGE: Record<TipoSolicitacao, { label: string; className: string }> = {
  desligamento:       { label: 'Desligamento',      className: 'bg-red-50 text-red-700 ring-red-200'           },
  transferencia:      { label: 'Transferência',      className: 'bg-blue-50 text-blue-700 ring-blue-200'        },
  mudanca_funcao:     { label: 'Mudança de Função',  className: 'bg-indigo-50 text-indigo-700 ring-indigo-200'  },
  promocao:           { label: 'Promoção',           className: 'bg-green-50 text-green-700 ring-green-200'     },
  mudanca_supervisor: { label: 'Mudança Supervisor', className: 'bg-purple-50 text-purple-700 ring-purple-200'  },
  alteracao_salario:   { label: 'Alteração Salarial',   className: 'bg-amber-50 text-amber-700 ring-amber-200'    },
  afastamento:         { label: 'Afastamento',          className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  retorno_afastamento: { label: 'Retorno Afastamento',  className: 'bg-teal-50 text-teal-700 ring-teal-200'       },
  rescisao_indireta:   { label: 'Rescisão Indireta',    className: 'bg-rose-50 text-rose-700 ring-rose-200'       },
}

const STATUS_BADGE = {
  pendente:  { label: 'Pendente',  className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  aprovada:  { label: 'Aprovada',  className: 'bg-green-50 text-green-700 ring-green-200' },
  rejeitada: { label: 'Rejeitada', className: 'bg-red-50 text-red-700 ring-red-200'       },
}

const CAMPO_LABELS: Record<string, string> = {
  novo_salario:        'Novo salário',
  data_desligamento:   'Data desligamento',
  motivo:              'Motivo',
  posto_destino_nome:  'Posto destino',
  funcao_destino_nome: 'Função destino',
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function DadosResumo({ dados }: { dados: Record<string, unknown> | null }) {
  if (!dados) return null
  const entries = Object.entries(dados).filter(([k]) => !k.endsWith('_id'))
  if (!entries.length) return null
  return (
    <dl className="mt-3 space-y-1 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-1.5">
          <dt className="shrink-0 font-medium text-gray-500">
            {CAMPO_LABELS[k] ?? k.replace(/_/g, ' ')}:
          </dt>
          <dd className="text-gray-700 break-words">{String(v ?? '—')}</dd>
        </div>
      ))}
    </dl>
  )
}

function SolicitacaoCard({ sol }: { sol: SolicitacaoRow }) {
  const tipo   = TIPO_BADGE[sol.tipo]
  const status = STATUS_BADGE[sol.status]

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                tipo.className,
              )}
            >
              {tipo.label}
            </span>
            <span className="text-sm font-medium text-gray-800">
              {sol.funcionarios?.nome ?? '—'}
            </span>
          </div>
          <p className="text-xs text-gray-400">{fmt(sol.created_at)}</p>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
            status.className,
          )}
        >
          {status.label}
        </span>
      </div>

      <DadosResumo dados={sol.dados_depois} />

      {sol.status === 'rejeitada' && sol.observacao_admin && (
        <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          <span className="font-semibold">Motivo da rejeição:</span> {sol.observacao_admin}
        </p>
      )}
    </div>
  )
}

export function SolicitacoesSupervisor({
  solicitacoes,
}: {
  solicitacoes: SolicitacaoRow[]
}) {
  const [filtro, setFiltro] = useState<StatusFilter>('todas')

  const counts = {
    todas:     solicitacoes.length,
    pendente:  solicitacoes.filter(s => s.status === 'pendente').length,
    aprovada:  solicitacoes.filter(s => s.status === 'aprovada').length,
    rejeitada: solicitacoes.filter(s => s.status === 'rejeitada').length,
  }

  const filtered =
    filtro === 'todas' ? solicitacoes : solicitacoes.filter(s => s.status === filtro)

  const PILLS: { key: StatusFilter; label: string }[] = [
    { key: 'todas',     label: 'Todas'      },
    { key: 'pendente',  label: 'Pendentes'  },
    { key: 'aprovada',  label: 'Aprovadas'  },
    { key: 'rejeitada', label: 'Rejeitadas' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PILLS.map(p => (
          <button
            key={p.key}
            type="button"
            onClick={() => setFiltro(p.key)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
              filtro === p.key
                ? 'bg-slate-900 text-white'
                : 'bg-white text-gray-500 ring-1 ring-gray-200 hover:ring-gray-400',
            )}
          >
            {p.label}
            <span className="ml-1.5 opacity-60">{counts[p.key]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400 shadow-sm">
          Nenhuma solicitação encontrada.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => (
            <SolicitacaoCard key={s.id} sol={s} />
          ))}
        </div>
      )}
    </div>
  )
}
