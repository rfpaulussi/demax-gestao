'use client'

import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TipoSolicitacao, StatusSolicitacao } from '@/types'
import { downloadMovimentacaoPDF } from './movimentacao-pdf'
import type { FuncionarioParaPDF } from './movimentacao-pdf'
import { getDadosMovColaborador } from '@/lib/movimentacao-colaborador'
import { downloadMovColaboradorPDF } from './movimentacao-colaborador-pdf'

// ─── types ────────────────────────────────────────────────────────────────────

export type MovimentacaoItem = {
  id: string
  tipo: string
  campo_alterado: string | null
  valor_antes: string | null
  valor_depois: string | null
  created_at: string | null
  solicitacao_id: string | null
  perfis: { nome: string | null } | null
  solicitacoes: {
    dados_antes: Record<string, unknown> | null
    dados_depois: Record<string, unknown> | null
    motivo: string | null
  } | null
}

export type AdvertenciaItem = {
  id: string
  tipo: string | null
  descricao: string | null
  data_ocorrencia: string | null
  status: 'pendente' | 'gerada' | 'entregue' | null
}

export type SolicitacaoItem = {
  id: string
  tipo: TipoSolicitacao
  status: StatusSolicitacao
  motivo: string | null
  created_at: string | null
  observacao_admin: string | null
  perfis: { nome: string | null } | null
}

type Tab = 'movimentacoes' | 'afastamentos' | 'advertencias' | 'solicitacoes'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const d = iso.split('T')[0].split('-').reverse().join('/')
  const t = iso.includes('T') ? ' ' + iso.split('T')[1].slice(0, 5) : ''
  return d + t
}

const STATUS_SOL: Record<StatusSolicitacao, { label: string; className: string }> = {
  pendente:  { label: 'Pendente',  className: 'bg-yellow-50 text-yellow-700 ring-yellow-200' },
  aprovada:  { label: 'Aprovada',  className: 'bg-green-50 text-green-700 ring-green-200'   },
  rejeitada: { label: 'Rejeitada', className: 'bg-red-50 text-red-700 ring-red-200'         },
}

const STATUS_ADV: Record<NonNullable<AdvertenciaItem['status']>, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-yellow-50 text-yellow-700 ring-yellow-200' },
  gerada:   { label: 'Gerada',   className: 'bg-blue-50 text-blue-700 ring-blue-200'       },
  entregue: { label: 'Entregue', className: 'bg-green-50 text-green-700 ring-green-200'    },
}

// ─── sub-views ────────────────────────────────────────────────────────────────

function MovDetail({
  m,
  postoNomeMap,
}: {
  m: MovimentacaoItem
  postoNomeMap: Record<string, string>
}) {
  if (m.tipo === 'mudanca_funcao') {
    const sol    = m.solicitacoes
    const antes  = sol?.dados_antes?.['funcao_nome'] as string | undefined
    const depois = sol?.dados_depois?.['funcao_destino_nome'] as string | undefined
    return (
      <div className="mt-0.5 space-y-0.5">
        <p className="text-xs text-gray-700">
          <span className="line-through text-gray-400">{antes ?? m.valor_antes ?? '—'}</span>
          {' → '}
          <span className="font-medium text-gray-900">{depois ?? m.valor_depois ?? '—'}</span>
        </p>
        {sol?.motivo && (
          <p className="text-xs text-gray-400">Motivo: {sol.motivo}</p>
        )}
      </div>
    )
  }

  if (m.tipo === 'transferencia' && m.campo_alterado === 'posto_id') {
    const antes  = (m.valor_antes  && postoNomeMap[m.valor_antes])  ? postoNomeMap[m.valor_antes]  : (m.valor_antes  ?? '—')
    const depois = (m.valor_depois && postoNomeMap[m.valor_depois]) ? postoNomeMap[m.valor_depois] : (m.valor_depois ?? '—')
    return (
      <p className="mt-0.5 text-xs text-gray-500">
        posto:{' '}
        <span className="line-through text-gray-400">{antes}</span>
        {' → '}
        <span className="text-gray-700">{depois}</span>
      </p>
    )
  }

  if (m.campo_alterado) {
    return (
      <p className="mt-0.5 text-xs text-gray-500">
        {m.campo_alterado}:{' '}
        <span className="line-through text-gray-400">{m.valor_antes ?? '—'}</span>
        {' → '}
        <span className="text-gray-700">{m.valor_depois ?? '—'}</span>
      </p>
    )
  }

  return null
}

function TabMovimentacoes({
  items,
  funcionario,
  postoNomeMap,
}: {
  items: MovimentacaoItem[]
  funcionario: FuncionarioParaPDF
  postoNomeMap: Record<string, string>
}) {
  const [baixando, setBaixando] = useState<string | null>(null)

  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">Nenhuma movimentação registrada.</p>
  }

  async function handleDownload(mov: MovimentacaoItem) {
    setBaixando(mov.id)
    try {
      if (mov.tipo === 'mudanca_funcao') {
        const dados = await getDadosMovColaborador(
          funcionario.id,
          mov.valor_antes,
          mov.valor_depois,
          mov.created_at,
          mov.solicitacao_id,
        )
        if (dados) await downloadMovColaboradorPDF(dados, mov.tipo)
      } else {
        await downloadMovimentacaoPDF(mov, funcionario)
      }
    } finally {
      setBaixando(null)
    }
  }

  return (
    <ol className="relative ml-3 border-l border-gray-200">
      {items.map(m => (
        <li key={m.id} className="mb-6 ml-5">
          <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-white bg-slate-400" />
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-gray-400">
                {m.created_at ? fmt(m.created_at) : '—'}
                {m.perfis?.nome && <span> · {m.perfis.nome}</span>}
              </p>
              <p className="mt-0.5 text-sm font-semibold capitalize text-gray-900">
                {m.tipo.replace(/_/g, ' ')}
              </p>
              <MovDetail m={m} postoNomeMap={postoNomeMap} />
            </div>
            <button
              onClick={() => handleDownload(m)}
              disabled={baixando === m.id}
              title="Baixar termo em PDF"
              className="shrink-0 rounded bg-amber-500 px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50 flex items-center gap-1"
            >
              <FileDown className="h-3 w-3" />
              {baixando === m.id ? '...' : 'PDF'}
            </button>
          </div>
        </li>
      ))}
    </ol>
  )
}

function TabAfastamentos({
  items,
  funcionario,
  postoNomeMap,
}: {
  items: MovimentacaoItem[]
  funcionario: FuncionarioParaPDF
  postoNomeMap: Record<string, string>
}) {
  const afastamentos = items.filter(m => m.tipo === 'afastamento' || m.tipo === 'atestado')
  if (afastamentos.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">Nenhum afastamento registrado.</p>
  }
  return <TabMovimentacoes items={afastamentos} funcionario={funcionario} postoNomeMap={postoNomeMap} />
}

function TabAdvertencias({ items }: { items: AdvertenciaItem[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">Nenhuma advertência registrada.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-100 bg-slate-50">
          <tr>
            {['Data', 'Tipo', 'Descrição', 'Status'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map(a => {
            const badge = a.status ? STATUS_ADV[a.status] : null
            return (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">
                  {a.data_ocorrencia ? fmt(a.data_ocorrencia) : '—'}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{a.tipo ?? '—'}</td>
                <td className="max-w-52 truncate px-4 py-3 text-gray-500">{a.descricao ?? '—'}</td>
                <td className="px-4 py-3">
                  {badge && (
                    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', badge.className)}>
                      {badge.label}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TabSolicitacoes({ items }: { items: SolicitacaoItem[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">Nenhuma solicitação registrada.</p>
  }
  return (
    <div className="space-y-3">
      {items.map(s => {
        const badge = STATUS_SOL[s.status]
        return (
          <div key={s.id} className="rounded-lg border border-gray-100 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold capitalize text-gray-900">
                  {s.tipo.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-gray-400">
                  {s.created_at ? fmt(s.created_at) : '—'}
                  {s.perfis?.nome && <span> · por {s.perfis.nome}</span>}
                </p>
                {s.motivo && <p className="mt-1 text-xs text-gray-500">{s.motivo}</p>}
                {s.observacao_admin && (
                  <p className="mt-1 text-xs italic text-gray-500">Admin: {s.observacao_admin}</p>
                )}
              </div>
              <span className={cn('inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', badge.className)}>
                {badge.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: 'movimentacoes', label: 'Movimentações' },
  { key: 'afastamentos',  label: 'Afastamentos'  },
  { key: 'advertencias',  label: 'Advertências'  },
  { key: 'solicitacoes',  label: 'Solicitações'  },
]

export function PerfilTabs({
  movimentacoes,
  advertencias,
  solicitacoes,
  funcionario,
  postoNomeMap = {},
}: {
  movimentacoes: MovimentacaoItem[]
  advertencias: AdvertenciaItem[]
  solicitacoes: SolicitacaoItem[]
  funcionario: FuncionarioParaPDF
  postoNomeMap?: Record<string, string>
}) {
  const [tab, setTab] = useState<Tab>('movimentacoes')

  return (
    <div>
      <div className="flex gap-0 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-3 text-xs font-semibold uppercase tracking-widest transition-colors',
              tab === t.key
                ? 'border-b-2 border-slate-900 text-slate-900'
                : 'text-gray-400 hover:text-gray-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-4">
        {tab === 'movimentacoes' && <TabMovimentacoes items={movimentacoes} funcionario={funcionario} postoNomeMap={postoNomeMap} />}
        {tab === 'afastamentos'  && <TabAfastamentos  items={movimentacoes} funcionario={funcionario} postoNomeMap={postoNomeMap} />}
        {tab === 'advertencias'  && <TabAdvertencias  items={advertencias}  />}
        {tab === 'solicitacoes'  && <TabSolicitacoes  items={solicitacoes}  />}
      </div>
    </div>
  )
}
