'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { aprovarSolicitacao, rejeitarSolicitacao, aprovarEmLote, rejeitarEmLote } from '@/app/(admin)/aprovacoes/actions'
import { PostoImpactPanel } from '@/components/posto-impact-panel'
import { TIPO_BADGE, badgeDaSolicitacao, fmtData, resumoCurto } from './campos-solicitacao'
import { ModalDetalheSolicitacao, type FuncaoOpt } from './modal-detalhe-solicitacao'
import type { ImpactoResult } from '@/app/(admin)/efetivo/impacto'
import type { TipoSolicitacao } from '@/types'

// ─── types ────────────────────────────────────────────────────────────────────

export type SolicitacaoPendente = {
  id: string
  tipo: TipoSolicitacao
  status?: 'pendente' | 'aprovada' | 'rejeitada'
  observacao_admin?: string | null
  motivo: string | null
  dados_antes: Record<string, unknown> | null
  dados_depois: Record<string, unknown> | null
  created_at: string | null
  funcionarios: { nome: string; cpf: string | null; postos?: { nome: string; secretaria: string | null } | null } | null
  perfis: { nome: string | null; email: string | null } | null
}

// ─── card ─────────────────────────────────────────────────────────────────────

const TIPOS_SEM_LOTE: TipoSolicitacao[] = ['admissao'] // admissão costuma exigir conferência/correção antes de aprovar

function diasDesde(iso: string | null): number | null {
  if (!iso) return null
  const dia = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const a = new Date(dia(new Date(iso)) + 'T00:00:00Z').getTime()
  const b = new Date(dia(new Date()) + 'T00:00:00Z').getTime()
  return Math.round((b - a) / 86_400_000)
}

type CardProps = {
  sol: SolicitacaoPendente
  canApprove: boolean
  impacto?: ImpactoResult
  funcoes: FuncaoOpt[]
  selecionada: boolean
  onToggle?: () => void
}

function SolicitacaoCard({ sol, canApprove: podeAprovar, impacto, funcoes, selecionada, onToggle }: CardProps) {
  const decidida = !!sol.status && sol.status !== 'pendente'
  const canApprove = podeAprovar && !decidida
  const idade = diasDesde(sol.created_at)
  const [isPending, startTransition] = useTransition()
  const [rejeitando, setRejeitando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [detalheAberto, setDetalheAberto] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const router = useRouter()

  const badge = badgeDaSolicitacao(sol.tipo, sol.dados_depois)

  function setOverride(chave: string, valor: string) {
    setOverrides(prev => ({ ...prev, [chave]: valor }))
  }

  function handleAprovar() {
    setErro(null)
    // Só manda pro server o que o admin realmente tocou (string vazia = não editado/limpo).
    const overridesPreenchidos = Object.fromEntries(
      Object.entries(overrides).filter(([, v]) => v !== ''),
    )
    startTransition(async () => {
      const result = await aprovarSolicitacao(
        sol.id,
        undefined,
        Object.keys(overridesPreenchidos).length > 0 ? overridesPreenchidos : undefined,
      )
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

  function iniciarRejeicao() { setRejeitando(true) }
  function cancelarRejeicao() { setRejeitando(false); setMotivo('') }

  return (
    <div className={cn(
      'rounded-xl border bg-white p-3 shadow-sm transition-shadow hover:shadow-md',
      selecionada ? 'border-slate-900 ring-1 ring-slate-900' : 'border-gray-200',
    )}>
      {/* Header compacto */}
      <div className="mb-2 flex items-start justify-between gap-2">
        {onToggle && (
          <input
            type="checkbox"
            checked={selecionada}
            onChange={onToggle}
            aria-label="Selecionar solicitação"
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-slate-900"
          />
        )}
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', badge.className)}>
          {badge.label}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-gray-400">
          {decidida && (
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
              sol.status === 'aprovada' ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-red-50 text-red-700 ring-red-200',
            )}>
              {sol.status === 'aprovada' ? 'Aprovada' : 'Rejeitada'}
            </span>
          )}
          {!decidida && idade !== null && idade >= 1 && (
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
              idade >= 3 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700',
            )}>
              há {idade} dia{idade === 1 ? '' : 's'}
            </span>
          )}
          {sol.created_at ? fmtData(sol.created_at) : ''}
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

      {/* Resumo */}
      <p className="mb-2 text-xs text-gray-600">
        {resumoCurto(sol.tipo, sol.dados_antes, sol.dados_depois)}
      </p>

      {/* Impacto nos postos */}
      {impacto && (
        <div className="mb-2">
          <PostoImpactPanel impacto={impacto} />
        </div>
      )}

      <button
        type="button"
        onClick={() => setDetalheAberto(true)}
        className="mb-2 text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
      >
        Ver detalhes
      </button>

      {sol.status === 'rejeitada' && sol.observacao_admin && (
        <p className="mb-2 rounded border border-red-100 bg-red-50 px-2 py-1 text-xs text-red-700">Motivo da rejeição: {sol.observacao_admin}</p>
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
            onClick={iniciarRejeicao}
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
              onClick={cancelarRejeicao}
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

      <ModalDetalheSolicitacao
        sol={sol}
        impacto={impacto}
        canApprove={canApprove}
        open={detalheAberto}
        onClose={() => setDetalheAberto(false)}
        pending={isPending}
        erro={erro}
        rejeitando={rejeitando}
        motivo={motivo}
        onMotivoChange={setMotivo}
        onIniciarRejeicao={iniciarRejeicao}
        onCancelarRejeicao={cancelarRejeicao}
        onAprovar={handleAprovar}
        onRejeitar={handleRejeitar}
        overrides={overrides}
        onOverrideChange={setOverride}
        funcoes={funcoes}
      />
    </div>
  )
}

// ─── lista principal ──────────────────────────────────────────────────────────

const TIPO_ORDEM: TipoSolicitacao[] = [
  'transferencia', 'mudanca_funcao', 'mudanca_horario', 'desligamento', 'rescisao_indireta',
  'promocao', 'mudanca_supervisor', 'alteracao_salario', 'afastamento',
  'retorno_afastamento', 'admissao', 'lancamento_atestado', 'correcao_atestado',
]

type MensagemLote = { tipo: 'ok' | 'erro'; texto: string }

export function AprovacoesList({ solicitacoes, canApprove = true, impactos = {}, funcoes = [], exportar = false }: { solicitacoes: SolicitacaoPendente[]; canApprove?: boolean; impactos?: Record<string, ImpactoResult>; funcoes?: FuncaoOpt[]; exportar?: boolean }) {
  const router = useRouter()
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [rejeitandoLote, setRejeitandoLote] = useState(false)
  const [motivoLote, setMotivoLote] = useState('')
  const [msg, setMsg] = useState<MensagemLote | null>(null)
  const [pendingLote, startLote] = useTransition()

  const selecionaveis = canApprove
    ? solicitacoes.filter(s => (s.status ?? 'pendente') === 'pendente' && !TIPOS_SEM_LOTE.includes(s.tipo))
    : []
  // Só conta o que ainda está na lista (filtros/aprovações podem ter tirado itens)
  const idsSelecionados = selecionaveis.filter(s => selecionadas.has(s.id)).map(s => s.id)
  const todasMarcadas = selecionaveis.length > 0 && idsSelecionados.length === selecionaveis.length

  function toggle(id: string) {
    setSelecionadas(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  function limparLote() {
    setSelecionadas(new Set()); setRejeitandoLote(false); setMotivoLote('')
  }

  function resumirLote(r: Awaited<ReturnType<typeof aprovarEmLote>>, verbo: string) {
    if ('success' in r) { setMsg({ tipo: 'erro', texto: r.error }); return }
    const nomes = (id: string) => solicitacoes.find(s => s.id === id)?.funcionarios?.nome ?? id
    if (r.falhas.length === 0) {
      setMsg({ tipo: 'ok', texto: `${r.ok} solicitaç${r.ok === 1 ? 'ão' : 'ões'} ${verbo}${r.ok === 1 ? '' : 's'}.` })
      limparLote()
    } else {
      setMsg({
        tipo: 'erro',
        texto: `${r.ok} ${verbo}${r.ok === 1 ? '' : 's'}, ${r.falhas.length} com erro: ` + r.falhas.map(f => `${nomes(f.id)} (${f.error})`).join('; '),
      })
      setSelecionadas(new Set(r.falhas.map(f => f.id)))
      setRejeitandoLote(false)
    }
    router.refresh()
  }

  function aprovarLote() {
    setMsg(null)
    startLote(async () => resumirLote(await aprovarEmLote(idsSelecionados), 'aprovada'))
  }

  function rejeitarLote() {
    if (!motivoLote.trim()) return
    setMsg(null)
    startLote(async () => resumirLote(await rejeitarEmLote(idsSelecionados, motivoLote), 'rejeitada'))
  }

  async function baixarExcel() {
    const { exportToExcel } = await import('@/lib/export-excel')
    const STATUS = { pendente: 'Pendente', aprovada: 'Aprovada', rejeitada: 'Rejeitada' }
    exportToExcel(solicitacoes, [
      { label: 'Data', value: s => (s.created_at ? fmtData(s.created_at) : ''), asText: true },
      { label: 'Tipo', value: s => TIPO_BADGE[s.tipo]?.label ?? s.tipo },
      { label: 'Status', value: s => STATUS[s.status ?? 'pendente'] },
      { label: 'Funcionário', value: s => s.funcionarios?.nome },
      { label: 'Posto', value: s => s.funcionarios?.postos?.nome },
      { label: 'Secretaria', value: s => s.funcionarios?.postos?.secretaria },
      { label: 'Solicitante', value: s => s.perfis?.nome ?? s.perfis?.email },
      { label: 'Resumo', value: s => resumoCurto(s.tipo, s.dados_antes, s.dados_depois) },
      { label: 'Motivo', value: s => s.motivo },
      { label: 'Observação do admin', value: s => s.observacao_admin },
    ], `aprovacoes-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

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

  // Fila: pendentes mais antigas primeiro; o resto mantém a ordem (mais recentes primeiro)
  for (const t of Object.keys(porTipo)) {
    if (porTipo[t].every(s => (s.status ?? 'pendente') === 'pendente')) {
      porTipo[t] = [...porTipo[t]].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    }
  }

  const tiposOrdenados = TIPO_ORDEM.filter(t => porTipo[t])

  return (
    <div className="space-y-6">
      {(selecionaveis.length > 0 || exportar) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {selecionaveis.length > 0 ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={todasMarcadas}
                onChange={() => setSelecionadas(todasMarcadas ? new Set() : new Set(selecionaveis.map(s => s.id)))}
                className="h-4 w-4 accent-slate-900"
              />
              Selecionar todas ({selecionaveis.length})
            </label>
          ) : <span />}
          {exportar && (
            <button
              type="button"
              onClick={baixarExcel}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-400"
            >
              Exportar Excel ({solicitacoes.length})
            </button>
          )}
        </div>
      )}

      {msg && (
        <p className={cn(
          'rounded-lg border px-3 py-2 text-xs',
          msg.tipo === 'ok' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700',
        )}>
          {msg.texto}
        </p>
      )}

      {tiposOrdenados.map(tipo => (
        <div key={tipo}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
            {TIPO_BADGE[tipo]?.label ?? tipo} ({porTipo[tipo].length})
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {porTipo[tipo].map(sol => {
              const lote = selecionaveis.some(x => x.id === sol.id)
              return (
                <SolicitacaoCard
                  key={sol.id}
                  sol={sol}
                  canApprove={canApprove}
                  impacto={impactos[sol.id]}
                  funcoes={funcoes}
                  selecionada={selecionadas.has(sol.id)}
                  onToggle={lote ? () => toggle(sol.id) : undefined}
                />
              )
            })}
          </div>
        </div>
      ))}

      {idsSelecionados.length > 0 && (
        <div className="sticky bottom-4 z-30 mx-auto w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-900 p-3 text-white shadow-xl">
          {!rejeitandoLote ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold">
                {idsSelecionados.length} selecionada{idsSelecionados.length === 1 ? '' : 's'}
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={limparLote} disabled={pendingLote}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs hover:bg-slate-800 disabled:opacity-50">
                  Limpar
                </button>
                <button type="button" onClick={() => setRejeitandoLote(true)} disabled={pendingLote}
                  className="rounded-lg border border-red-400 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-slate-800 disabled:opacity-50">
                  Rejeitar
                </button>
                <button type="button" onClick={aprovarLote} disabled={pendingLote}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold hover:bg-green-700 disabled:opacity-50">
                  {pendingLote ? 'Aprovando…' : `Aprovar ${idsSelecionados.length}`}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={motivoLote}
                onChange={e => setMotivoLote(e.target.value)}
                rows={2}
                placeholder={`Motivo da rejeição (vale para as ${idsSelecionados.length} selecionadas)…`}
                className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setRejeitandoLote(false); setMotivoLote('') }} disabled={pendingLote}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs hover:bg-slate-800">
                  Cancelar
                </button>
                <button type="button" onClick={rejeitarLote} disabled={!motivoLote.trim() || pendingLote}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold hover:bg-red-700 disabled:opacity-50">
                  {pendingLote ? 'Rejeitando…' : 'Confirmar rejeição'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
