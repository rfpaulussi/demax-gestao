import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import {
  buscarKPIsDashboard,
  buscarAlertasDashboard,
  buscarProximasFerias,
  buscarAtestadosRecentes,
  buscarEvolucaoEfetivo,
  buscarSecretariaData,
  buscarExperienciasDashboard,
  buscarDeltaKPIs,
  buscarOcorrenciasMes,
} from './actions'
import { AlertasCriticos } from '@/components/dashboard/alertas-criticos'
import { ProximasFerias } from '@/components/dashboard/proximas-ferias'
import { AtestadosRecentes } from '@/components/dashboard/atestados-recentes'
import { EvolucaoEfetivo } from '@/components/dashboard/evolucao-efetivo'
import { EfetivoPorSecretaria } from '@/components/dashboard/efetivo-por-secretaria'

// ─── Sparkline SVG ────────────────────────────────────────────────────────────

function Sparkline({ data, color = '#3b82f6' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return <div className="h-11 w-[90px]" />
  const w = 90, h = 44
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - 4 - ((v - min) / range) * (h - 10)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} aria-hidden="true" className="opacity-80">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── KpiCardPrincipal ─────────────────────────────────────────────────────────

function KpiCardPrincipal({
  label,
  valor,
  corBorda,
  delta,
  aviso,
  criticos,
  sparklineData,
  sparkColor,
  href,
}: {
  label: string
  valor: number
  corBorda: string
  delta?: { valor: number; texto: string } | null
  aviso?: string
  criticos?: number
  sparklineData?: number[]
  sparkColor?: string
  href?: string
}) {
  const inner = (
    <div
      className={cn(
        'rounded-xl border border-gray-100 border-t-4 bg-white p-3 shadow-sm transition-shadow min-h-[100px] sm:min-h-[120px] flex flex-col justify-between',
        href && 'cursor-pointer hover:shadow-md',
        corBorda,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-2xl font-black tracking-tight text-gray-900">{valor}</p>
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
        </div>
        {sparklineData && sparklineData.length >= 2 && (
          <div className="hidden sm:block flex-shrink-0">
            <Sparkline data={sparklineData} color={sparkColor} />
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 min-h-[20px]">
        {delta != null && (
          <span
            className={cn(
              'text-xs font-semibold',
              delta.valor > 0 ? 'text-green-600' : delta.valor < 0 ? 'text-red-600' : 'text-gray-400',
            )}
          >
            {delta.valor > 0 ? '▲' : delta.valor < 0 ? '▼' : '–'}{' '}
            {delta.valor !== 0 ? Math.abs(delta.valor) : ''} {delta.texto}
          </span>
        )}
        {aviso && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            ⚑ {aviso}
          </span>
        )}
        {criticos != null && criticos > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
            {criticos} críticos
          </span>
        )}
      </div>
    </div>
  )
  if (href) return <Link href={href}>{inner}</Link>
  return inner
}

// ─── KpiMini ──────────────────────────────────────────────────────────────────

function KpiMini({
  label,
  value,
  href,
}: {
  label: string
  value: number
  href?: string
}) {
  const inner = (
    <div
      className={cn(
        'rounded-lg border border-gray-100 bg-gray-50 p-3 transition-colors',
        href && 'cursor-pointer hover:bg-gray-100',
      )}
    >
      <p className="text-2xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
  if (href) return <Link href={href}>{inner}</Link>
  return inner
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { periodo?: string }
}) {
  const periodo = searchParams?.periodo ?? '30d'
  const dias = periodo === 'hoje' ? 1 : periodo === '7d' ? 7 : 30

  const supabase = createClient()

  const [
    auth,
    kpis,
    alertas,
    proximasFerias,
    atestados,
    evolucao,
    secretarias,
    experiencias,
    deltaKPIs,
    ocorrencias,
  ] = await Promise.all([
    getUser(),
    buscarKPIsDashboard(),
    buscarAlertasDashboard(),
    buscarProximasFerias(dias),
    buscarAtestadosRecentes(dias),
    buscarEvolucaoEfetivo(),
    buscarSecretariaData(),
    buscarExperienciasDashboard(),
    buscarDeltaKPIs(),
    buscarOcorrenciasMes(dias),
  ])

  // Para supervisor: calcular mínimo contratual baseado nos seus postos
  let minimoContratual: number | undefined = undefined
  const role = (auth as unknown as { perfil?: { role?: string | null } } | null)?.perfil?.role
  if (role === 'supervisor' && auth) {
    const userId = (auth as unknown as { user: { id: string } }).user.id
    const { data: spPostos } = await supabase
      .from('config_supervisores_postos')
      .select('postos!posto_id(efetivo_previsto)')
      .eq('supervisor_id', userId)
      .eq('ativo', true)
    type SpRow = { postos: { efetivo_previsto: number | null } | null }
    minimoContratual = ((spPostos ?? []) as unknown as SpRow[])
      .reduce((sum, row) => sum + (row.postos?.efetivo_previsto ?? 0), 0)
  }

  const nomeUsuario = (auth as unknown as { perfil?: { nome?: string | null } } | null)?.perfil?.nome ?? ''
  const iniciais = nomeUsuario
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .reduce((acc: string[], p: string, i: number, arr: string[]) =>
      i === 0 || i === arr.length - 1 ? [...acc, p[0].toUpperCase()] : acc, []
    )
    .join('')
    .slice(0, 2) || '–'

  const hist = deltaKPIs.historico
  const sparkAtivos    = hist.slice(-7).map(h => h.ativos)
  const sparkAfastados = hist.slice(-7).map(h => h.afastados)
  const sparkFerias    = hist.slice(-7).map(h => h.em_ferias)

  const deltaAtivos    = deltaKPIs.ativos    != null ? { valor: deltaKPIs.ativos,    texto: 'vs ontem' } : null
  const deltaAfastados = deltaKPIs.afastados != null ? { valor: deltaKPIs.afastados, texto: 'vs ontem' } : null
  const deltaFerias    = deltaKPIs.emFerias   != null ? { valor: deltaKPIs.emFerias,   texto: 'vs ontem' } : null

  return (
    <div className="space-y-3">

      {/* ── Topbar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-lg border border-gray-200">
            <Link href="?periodo=hoje" className={cn('px-3 py-1.5 text-xs', periodo === 'hoje' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500')}>Hoje</Link>
            <Link href="?periodo=7d"   className={cn('px-3 py-1.5 text-xs', periodo === '7d'   ? 'bg-blue-600 text-white' : 'bg-white text-gray-500')}>7d</Link>
            <Link href="?periodo=30d"  className={cn('px-3 py-1.5 text-xs', periodo === '30d'  ? 'bg-blue-600 text-white' : 'bg-white text-gray-500')}>30d</Link>
          </div>
          {nomeUsuario && (
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
                {iniciais}
              </div>
              <span className="text-xs font-medium text-gray-800">{nomeUsuario.split(' ')[0]}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 1: KPI Cards principais ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCardPrincipal
          label="Efetivo Ativo"
          valor={kpis.totalAtivos}
          corBorda="border-t-blue-500"
          delta={deltaAtivos}
          sparklineData={sparkAtivos}
          sparkColor="#3b82f6"
          href="/efetivo?status=ativo"
        />
        <KpiCardPrincipal
          label="Afastados"
          valor={kpis.afastados}
          corBorda="border-t-amber-500"
          delta={deltaAfastados}
          sparklineData={sparkAfastados}
          sparkColor="#f59e0b"
          href="/efetivo?status=afastado"
        />
        <KpiCardPrincipal
          label="Em Férias"
          valor={kpis.emFerias}
          corBorda="border-t-green-500"
          delta={deltaFerias}
          aviso={kpis.feriasTerminando30dias > 0 ? `${kpis.feriasTerminando30dias} vencem em 30 dias` : undefined}
          sparklineData={sparkFerias}
          sparkColor="#22c55e"
          href="/efetivo?status=ferias"
        />
        <KpiCardPrincipal
          label="Postos em Déficit"
          valor={kpis.deficit}
          corBorda="border-t-red-500"
          criticos={kpis.postosCriticos}
        />
      </div>

      {/* ── Row 2: Alertas | [Mini KPIs + Próximas Férias] ─────────────────── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">

        {/* Coluna esquerda — Alertas Críticos */}
        <AlertasCriticos alertas={alertas} />

        {/* Coluna direita — Indicadores 2×2 + Próximas Férias */}
        <div className="flex flex-col gap-3">
          {/* Mini KPIs 2×2 */}
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
              Indicadores
            </p>
            <div className="grid grid-cols-2 gap-2">
              <KpiMini label="Aprovações Pend."  value={kpis.solicitacoesPendentes} href="/aprovacoes" />
              <KpiMini label="Coberturas Ativas" value={kpis.coberturasAtivas}      href="/coberturas" />
              <KpiMini label="Em Experiência"    value={experiencias.total}          href="/efetivo"    />
              <KpiMini label="Ocorrências Mês"   value={ocorrencias}                 href="/ocorrencias" />
            </div>
            {experiencias.vencendo7dias > 0 && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                <p className="text-xs font-medium text-orange-700">
                  {experiencias.vencendo7dias} experiência{experiencias.vencendo7dias > 1 ? 's' : ''} vence{experiencias.vencendo7dias > 1 ? 'm' : ''} em 7 dias
                </p>
              </div>
            )}
          </div>

          {/* Próximas Férias */}
          <ProximasFerias ferias={proximasFerias} />
        </div>

      </div>

      {/* ── Row 3: Evolução + Efetivo por Secretaria ────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <EvolucaoEfetivo dados={evolucao} minimoContratual={minimoContratual} />
        <EfetivoPorSecretaria secretarias={secretarias} />
      </div>

      {/* ── Row 4: Atestados Recentes (largura total, horizontal) ───────────── */}
      <AtestadosRecentes atestados={atestados} />

    </div>
  )
}
