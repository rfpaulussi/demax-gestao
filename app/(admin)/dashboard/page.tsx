import Link from 'next/link'
import {
  Users, UserMinus, Umbrella, TrendingDown, ClipboardList, ArrowLeftRight,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TipoSolicitacao } from '@/types'
import {
  buscarKPIsDashboard,
  buscarAlertasDashboard,
  buscarProximasFerias,
  buscarAtestadosRecentes,
  buscarEvolucaoEfetivo,
  buscarSecretariaData,
  buscarAprovacoesData,
} from './actions'
import { AlertasCriticos } from '@/components/dashboard/alertas-criticos'
import { ProximasFerias } from '@/components/dashboard/proximas-ferias'
import { AtestadosRecentes } from '@/components/dashboard/atestados-recentes'
import { EvolucaoEfetivo } from '@/components/dashboard/evolucao-efetivo'
import { EfetivoPorSecretaria } from '@/components/dashboard/efetivo-por-secretaria'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

// ─── TIPO_BADGE ───────────────────────────────────────────────────────────────

const TIPO_BADGE: Record<TipoSolicitacao, { label: string; className: string }> = {
  desligamento:       { label: 'Desligamento',      className: 'bg-red-50 text-red-700 ring-red-200'         },
  transferencia:      { label: 'Transferência',      className: 'bg-blue-50 text-blue-700 ring-blue-200'       },
  mudanca_funcao:     { label: 'Mudança Função',     className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  promocao:           { label: 'Promoção',           className: 'bg-green-50 text-green-700 ring-green-200'    },
  mudanca_supervisor: { label: 'Mudança Supervisor', className: 'bg-purple-50 text-purple-700 ring-purple-200' },
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  topColor,
  iconBg,
  href,
  subInfo,
}: {
  label: string
  value: number
  icon: LucideIcon
  topColor: string
  iconBg: string
  href?: string
  subInfo?: string
}) {
  const [iconClass, bgClass] = iconBg.split(' ')
  const inner = (
    <div
      className={cn(
        'rounded-xl border border-gray-100 border-t-4 bg-white p-5 shadow-sm transition-shadow',
        href && 'cursor-pointer hover:shadow-md',
        topColor
      )}
    >
      <div className={cn('inline-flex rounded-lg p-2.5', bgClass)}>
        <Icon className={cn('h-5 w-5', iconClass)} />
      </div>
      <p className="mt-3 text-4xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      {subInfo && <p className="mt-1 text-xs text-gray-500">{subInfo}</p>}
    </div>
  )
  if (href) return <Link href={href}>{inner}</Link>
  return inner
}

// ─── SectionTitle ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">{children}</h2>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const [kpis, alertas, proximasFerias, atestados, evolucao, secretarias, aprovacoes] =
    await Promise.all([
      buscarKPIsDashboard(),
      buscarAlertasDashboard(),
      buscarProximasFerias(7),
      buscarAtestadosRecentes(7),
      buscarEvolucaoEfetivo(),
      buscarSecretariaData(),
      buscarAprovacoesData(),
    ])

  return (
    <div className="space-y-8">

      {/* ── LINHA 1: KPI Cards ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionTitle>Visão geral</SectionTitle>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Ativos"
            value={kpis.totalAtivos}
            icon={Users}
            topColor="border-t-blue-500"
            iconBg="text-blue-600 bg-blue-50"
            href="/efetivo?status=ativo"
          />
          <KpiCard
            label="Afastados"
            value={kpis.afastados}
            icon={UserMinus}
            topColor="border-t-amber-500"
            iconBg="text-amber-600 bg-amber-50"
            href="/efetivo?status=afastado"
          />
          <KpiCard
            label="Em Férias"
            value={kpis.emFerias}
            icon={Umbrella}
            topColor="border-t-green-500"
            iconBg="text-green-600 bg-green-50"
            href="/efetivo?status=ferias"
            subInfo={
              kpis.feriasTerminando30dias > 0
                ? `⚑ ${kpis.feriasTerminando30dias} vencem em 30 dias`
                : undefined
            }
          />
          <KpiCard
            label="Postos em Déficit"
            value={kpis.deficit}
            icon={TrendingDown}
            topColor="border-t-red-500"
            iconBg="text-red-600 bg-red-50"
            subInfo={
              kpis.postosCriticos > 0
                ? `${kpis.postosCriticos} críticos (déficit ≥2)`
                : undefined
            }
          />
          <KpiCard
            label="Aprovações Pend."
            value={kpis.solicitacoesPendentes}
            icon={ClipboardList}
            topColor="border-t-purple-500"
            iconBg="text-purple-600 bg-purple-50"
            href="/aprovacoes"
          />
          <KpiCard
            label="Coberturas Ativas"
            value={kpis.coberturasAtivas}
            icon={ArrowLeftRight}
            topColor="border-t-indigo-500"
            iconBg="text-indigo-600 bg-indigo-50"
            href="/coberturas"
          />
        </div>
      </section>

      {/* ── LINHA 2: Alertas, Próximas Férias, Atestados ───────────────────── */}
      <section>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <AlertasCriticos alertas={alertas} />
          <ProximasFerias ferias={proximasFerias} />
          <AtestadosRecentes atestados={atestados} />
        </div>
      </section>

      {/* ── LINHA 3: Evolução do Efetivo + Efetivo por Secretaria ──────────── */}
      <section>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <EvolucaoEfetivo dados={evolucao} />
          <EfetivoPorSecretaria secretarias={secretarias} />
        </div>
      </section>

      {/* ── LINHA 4: Aprovações Pendentes (só se houver) ───────────────────── */}
      {aprovacoes.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle>Aprovações pendentes</SectionTitle>
            <Link href="/aprovacoes" className="text-xs font-semibold text-slate-600 hover:text-slate-900">
              Ver todas →
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <ul className="divide-y divide-gray-50">
              {aprovacoes.map(s => {
                const tipo = s.tipo as TipoSolicitacao
                const badge = TIPO_BADGE[tipo] ?? { label: s.tipo, className: 'bg-gray-50 text-gray-600 ring-gray-200' }
                return (
                  <li key={s.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                          badge.className
                        )}
                      >
                        {badge.label}
                      </span>
                      <p className="text-sm font-medium text-gray-900">{s.funcionarioNome}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">{s.supervisorNome ?? '—'}</p>
                      {s.created_at && (
                        <p className="text-xs text-gray-400">{fmt(s.created_at)}</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      )}

    </div>
  )
}
