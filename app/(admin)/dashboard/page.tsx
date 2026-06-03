import Link from 'next/link'
import {
  Users, UserMinus, Umbrella, TrendingDown, ClipboardList, ArrowLeftRight,
  AlertCircle, AlertTriangle, CheckCircle2, type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import type { TipoSolicitacao } from '@/types'

// ─── types ────────────────────────────────────────────────────────────────────

type SolicitacaoPendente = {
  id: string
  tipo: TipoSolicitacao
  created_at: string | null
  funcionarios: { nome: string; cpf: string | null } | null
  perfis: { nome: string | null } | null
}

type RetornoHoje = {
  id: string
  data_prev_retorno: string | null
  funcionarios: { nome: string } | null
  postos: { nome: string } | null
}

type InsalubreAberta = {
  id: string
  created_at: string | null
  funcionarios: { nome: string } | null
  postos: { nome: string } | null
}

type PostoItem = {
  id: string
  nome: string
  secretaria: string | null
  efetivo_previsto: number | null
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

const TIPO_BADGE: Record<TipoSolicitacao, { label: string; className: string }> = {
  desligamento:       { label: 'Desligamento',      className: 'bg-red-50 text-red-700 ring-red-200'         },
  transferencia:      { label: 'Transferência',      className: 'bg-blue-50 text-blue-700 ring-blue-200'       },
  mudanca_funcao:     { label: 'Mudança Função',     className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  promocao:           { label: 'Promoção',           className: 'bg-green-50 text-green-700 ring-green-200'    },
  mudanca_supervisor: { label: 'Mudança Supervisor', className: 'bg-purple-50 text-purple-700 ring-purple-200' },
}

// ─── sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, icon: Icon, topColor, iconBg, href,
}: {
  label: string; value: number; icon: LucideIcon; topColor: string; iconBg: string; href?: string
}) {
  const [iconClass, bgClass] = iconBg.split(' ')
  const inner = (
    <div className={cn(
      'rounded-xl border border-gray-100 border-t-4 bg-white p-5 shadow-sm transition-shadow',
      href && 'cursor-pointer hover:shadow-md',
      topColor,
    )}>
      <div className={cn('inline-flex rounded-lg p-2.5', bgClass)}>
        <Icon className={cn('h-5 w-5', iconClass)} />
      </div>
      <p className="mt-3 text-4xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
  if (href) return <Link href={href}>{inner}</Link>
  return inner
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">{children}</h2>
}

type Severity = 'critical' | 'warning'

function PendenciaRow({
  href,
  severity,
  children,
}: {
  href: string
  severity: Severity
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50"
    >
      {severity === 'critical'
        ? <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
        : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
      }
      <span className={cn(
        'flex-1 text-sm font-medium',
        severity === 'critical' ? 'text-red-700' : 'text-amber-700',
      )}>
        {children}
      </span>
      <span className="text-xs text-gray-400">→</span>
    </Link>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = createClient()

  const today     = new Date()
  const todayStr  = today.toISOString().split('T')[0]
  const tomorrow  = new Date(today.getTime() + 86_400_000)
  const tomorrowStr     = tomorrow.toISOString().split('T')[0]
  const sevenDaysAgo    = new Date(today.getTime() - 7 * 86_400_000).toISOString()
  const threeDaysAgoStr = new Date(today.getTime() - 3 * 86_400_000).toISOString()

  const [
    { count: totalAtivos },
    { count: afastados },
    { count: emFerias },
    { count: coberturasAtivas },
    { count: solicitacoesPendentes },
    { data: postosData },
    { data: funcAtivosData },
    { data: solicitacoesPendentesData },
    { data: retornosHojeData },
    { data: insalubreAbertasData },
    // pendências operacionais
    { count: funcSemPostoCount },
    { data: coberturasVencendoData },
    { count: solsAntigasCount },
  ] = await Promise.all([
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'afastado'),
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'ferias'),
    supabase.from('coberturas_temporarias').select('*', { count: 'exact', head: true }).eq('status', 'ativa'),
    supabase.from('solicitacoes').select('*', { count: 'exact', head: true }).eq('status', 'pendente'),
    supabase.from('postos').select('id, nome, secretaria, efetivo_previsto').eq('ativo', true).not('secretaria', 'is', null),
    supabase.from('funcionarios').select('posto_id').eq('status', 'ativo').not('posto_id', 'is', null),
    supabase
      .from('solicitacoes')
      .select('id, tipo, created_at, funcionarios!funcionario_id(nome, cpf), perfis!supervisor_id(nome)')
      .eq('status', 'pendente')
      .order('created_at', { ascending: true })
      .limit(5),
    supabase
      .from('coberturas_temporarias')
      .select('id, data_prev_retorno, funcionarios!funcionario_id(nome), postos!posto_destino_id(nome)')
      .eq('status', 'ativa')
      .eq('data_prev_retorno', todayStr),
    supabase
      .from('coberturas_insalubres')
      .select('id, created_at, funcionarios!funcionario_id(nome), postos!posto_id(nome)')
      .eq('status', 'pendente')
      .lte('created_at', sevenDaysAgo),
    // pendências
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'ativo').is('posto_id', null),
    supabase
      .from('coberturas_temporarias')
      .select('id, data_prev_retorno')
      .eq('status', 'ativa')
      .lte('data_prev_retorno', tomorrowStr),
    supabase.from('solicitacoes').select('*', { count: 'exact', head: true }).eq('status', 'pendente').lt('created_at', threeDaysAgoStr),
  ])

  const postos           = (postosData ?? []) as PostoItem[]
  const solsPendentes    = (solicitacoesPendentesData ?? []) as unknown as SolicitacaoPendente[]
  const retornosHoje     = (retornosHojeData ?? []) as unknown as RetornoHoje[]
  const insalubreAbertas = (insalubreAbertasData ?? []) as unknown as InsalubreAberta[]

  const coberturasVencendo = coberturasVencendoData ?? []
  const coberturasHoje     = coberturasVencendo.filter(c => c.data_prev_retorno === todayStr).length
  const coberturasAmanha   = coberturasVencendo.filter(c => c.data_prev_retorno === tomorrowStr).length

  // Postos por ID para lookup
  const postoById = new Map(postos.map(p => [p.id, p]))

  // Funcionários ativos por posto
  const funcPorPosto: Record<string, number> = {}
  for (const f of funcAtivosData ?? []) {
    if (f.posto_id) funcPorPosto[f.posto_id] = (funcPorPosto[f.posto_id] ?? 0) + 1
  }

  // Déficit: postos com gap > 0
  const deficit = postos.filter(p => (funcPorPosto[p.id] ?? 0) < (p.efetivo_previsto ?? 0)).length

  // Postos em déficit crítico (gap >= 2) para alertas
  const deficitCritico = postos
    .map(p => ({ ...p, gap: (p.efetivo_previsto ?? 0) - (funcPorPosto[p.id] ?? 0) }))
    .filter(p => p.gap >= 2)
    .slice(0, 5)

  // Efetivo por secretaria
  const secAgg = new Map<string, { previsto: number; real: number }>()
  for (const p of postos) {
    if (!p.secretaria) continue
    const agg = secAgg.get(p.secretaria) ?? { previsto: 0, real: 0 }
    agg.previsto += p.efetivo_previsto ?? 0
    secAgg.set(p.secretaria, agg)
  }
  for (const f of funcAtivosData ?? []) {
    if (!f.posto_id) continue
    const posto = postoById.get(f.posto_id)
    if (!posto?.secretaria) continue
    const agg = secAgg.get(posto.secretaria) ?? { previsto: 0, real: 0 }
    agg.real += 1
    secAgg.set(posto.secretaria, agg)
  }
  const secretarias = Array.from(secAgg.entries())
    .map(([nome, { previsto, real }]) => ({ nome, previsto, real }))
    .sort((a, b) => a.nome.localeCompare(b.nome))

  const temAlertas = retornosHoje.length > 0 || deficitCritico.length > 0 || insalubreAbertas.length > 0

  // Pendências operacionais
  const semPosto   = funcSemPostoCount ?? 0
  const solsAtigas = solsAntigasCount ?? 0
  const temPendencias = semPosto > 0 || coberturasHoje > 0 || coberturasAmanha > 0 || solsAtigas > 0

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* KPIs */}
      <section className="space-y-3">
        <SectionTitle>Visão geral</SectionTitle>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Ativos"            value={totalAtivos ?? 0}           icon={Users}          topColor="border-t-blue-500"   iconBg="text-blue-600 bg-blue-50"     href="/efetivo?status=ativo"     />
          <KpiCard label="Afastados"         value={afastados ?? 0}             icon={UserMinus}      topColor="border-t-orange-500" iconBg="text-orange-600 bg-orange-50" href="/efetivo?status=afastado"  />
          <KpiCard label="Em Férias"         value={emFerias ?? 0}              icon={Umbrella}       topColor="border-t-amber-500"  iconBg="text-amber-600 bg-amber-50"   href="/efetivo?status=ferias"    />
          <KpiCard label="Postos em Déficit" value={deficit}                    icon={TrendingDown}   topColor="border-t-red-500"    iconBg="text-red-600 bg-red-50"                                        />
          <KpiCard label="Aprovações Pend."  value={solicitacoesPendentes ?? 0} icon={ClipboardList}  topColor="border-t-violet-500" iconBg="text-violet-600 bg-violet-50" href="/aprovacoes"               />
          <KpiCard label="Coberturas Ativas" value={coberturasAtivas ?? 0}      icon={ArrowLeftRight} topColor="border-t-teal-500"   iconBg="text-teal-600 bg-teal-50"     href="/coberturas"               />
        </div>
      </section>

      {/* Pendências Operacionais */}
      <section className="space-y-3">
        <SectionTitle>Pendências operacionais</SectionTitle>
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {!temPendencias ? (
            <div className="flex items-center gap-2.5 px-5 py-4">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              <p className="text-sm font-medium text-green-700">Nenhuma pendência no momento.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {semPosto > 0 && (
                <li>
                  <PendenciaRow href="/efetivo" severity="critical">
                    {semPosto} funcionário{semPosto > 1 ? 's' : ''} ativo{semPosto > 1 ? 's' : ''} sem posto alocado
                  </PendenciaRow>
                </li>
              )}
              {coberturasHoje > 0 && (
                <li>
                  <PendenciaRow href="/coberturas" severity="critical">
                    {coberturasHoje} cobertura{coberturasHoje > 1 ? 's' : ''} com retorno previsto para hoje
                  </PendenciaRow>
                </li>
              )}
              {coberturasAmanha > 0 && (
                <li>
                  <PendenciaRow href="/coberturas" severity="warning">
                    {coberturasAmanha} cobertura{coberturasAmanha > 1 ? 's' : ''} vencendo amanhã
                  </PendenciaRow>
                </li>
              )}
              {solsAtigas > 0 && (
                <li>
                  <PendenciaRow href="/aprovacoes" severity="warning">
                    {solsAtigas} solicitação{solsAtigas > 1 ? 'ões' : ''} pendente{solsAtigas > 1 ? 's' : ''} há mais de 3 dias
                  </PendenciaRow>
                </li>
              )}
            </ul>
          )}
        </div>
      </section>

      {/* Aprovações Pendentes */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Aprovações pendentes</SectionTitle>
          <Link href="/aprovacoes" className="text-xs font-semibold text-slate-600 hover:text-slate-900">
            Ver todas →
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {solsPendentes.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-400">Nenhuma solicitação pendente.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {solsPendentes.map(s => {
                const badge = TIPO_BADGE[s.tipo]
                return (
                  <li key={s.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', badge.className)}>
                        {badge.label}
                      </span>
                      <p className="text-sm font-medium text-gray-900">{s.funcionarios?.nome ?? '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">{s.perfis?.nome ?? '—'}</p>
                      {s.created_at && <p className="text-xs text-gray-400">{fmt(s.created_at)}</p>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Alertas do Dia */}
      <section className="space-y-3">
        <SectionTitle>Alertas do dia</SectionTitle>
        {!temAlertas ? (
          <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-5 py-4 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <p className="text-sm font-medium text-green-700">Nenhum alerta no momento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {retornosHoje.length > 0 && (
              <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-500">
                  Retornos previstos para hoje ({retornosHoje.length})
                </p>
                <ul className="space-y-1">
                  {retornosHoje.map(r => (
                    <li key={r.id} className="text-sm text-gray-700">
                      {r.funcionarios?.nome ?? '—'} — {r.postos?.nome ?? '—'}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {deficitCritico.length > 0 && (
              <div className="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-red-500">
                  Postos em déficit crítico ({deficitCritico.length})
                </p>
                <ul className="space-y-1">
                  {deficitCritico.map(p => (
                    <li key={p.id} className="text-sm text-gray-700">
                      {p.nome} — faltam {p.gap} pessoa{p.gap > 1 ? 's' : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {insalubreAbertas.length > 0 && (
              <div className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber-500">
                  Coberturas insalubres abertas há mais de 7 dias ({insalubreAbertas.length})
                </p>
                <ul className="space-y-1">
                  {insalubreAbertas.map(c => (
                    <li key={c.id} className="text-sm text-gray-700">
                      {c.funcionarios?.nome ?? '—'} — {c.postos?.nome ?? '—'}
                      {c.created_at && <span className="ml-1 text-xs text-gray-400">(desde {fmt(c.created_at)})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Efetivo por Secretaria */}
      <section className="space-y-3">
        <SectionTitle>Efetivo por secretaria</SectionTitle>
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {secretarias.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-400">Sem dados de secretaria.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {secretarias.map(({ nome, previsto, real }) => {
                const pct = previsto > 0 ? Math.min(100, Math.round((real / previsto) * 100)) : 0
                const barColor = pct >= 90 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                return (
                  <li key={nome} className="px-5 py-4">
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">{nome}</p>
                      <p className="text-xs text-gray-400">
                        {real}/{previsto} <span className="font-semibold text-gray-600">{pct}%</span>
                      </p>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

    </div>
  )
}
