import Link from 'next/link'
import { AlertTriangle, CheckCircle2, MapPin, Clock, Stethoscope, Palmtree, ShieldAlert, Repeat2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { processarRetornosAtestado } from '@/lib/processar-retornos'
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
  buscarDadosSupervisor,
} from './actions'
import type { DadosSupervisor, SupervisorPostoKpi } from './actions'
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

// ─── SupervisorDashboard ──────────────────────────────────────────────────────

function fmtDate(d: string) {
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}

function PostoMiniCard({ posto }: { posto: SupervisorPostoKpi }) {
  const ausentes = posto.atestados + posto.ferias
  const cor = posto.descoberto
    ? 'border-t-red-500'
    : ausentes > 0
    ? 'border-t-amber-400'
    : 'border-t-green-500'

  return (
    <div className={cn('rounded-xl border border-gray-100 border-t-4 bg-white p-3 shadow-sm', cor)}>
      <p className="truncate text-xs font-semibold text-gray-800 leading-tight">{posto.nome}</p>
      {posto.secretaria && (
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-gray-400">{posto.secretaria}</p>
      )}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1 text-xs text-green-700">
          <span className="font-bold">{posto.ativos}</span>
          <span className="text-gray-400">/{posto.efetivo_previsto}</span>
        </span>
        {posto.atestados > 0 && (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
            {posto.atestados} atestado{posto.atestados > 1 ? 's' : ''}
          </span>
        )}
        {posto.ferias > 0 && (
          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
            {posto.ferias} férias
          </span>
        )}
        {posto.descoberto && (
          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
            sem cobertura
          </span>
        )}
      </div>
    </div>
  )
}

function SupervisorDashboard({ dados, nomeUsuario, hoje }: { dados: DadosSupervisor; nomeUsuario: string; hoje: string }) {
  const { kpis, postos, atestadosAtivos, coberturas, proximasFerias } = dados

  const postosComProblema = postos.filter(p => p.descoberto || p.atestados > 0 || p.ferias > 0)
    .sort((a, b) => (b.descoberto ? 1 : 0) - (a.descoberto ? 1 : 0))
  const postosOk = postos.filter(p => !p.descoberto && p.atestados === 0 && p.ferias === 0)

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Dashboard</h1>
          <p className="mt-0.5 text-sm capitalize text-gray-500">{hoje}</p>
        </div>
        {nomeUsuario && (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
              {nomeUsuario.trim().split(/\s+/).filter(Boolean).reduce((acc: string[], p, i, arr) =>
                i === 0 || i === arr.length - 1 ? [...acc, p[0].toUpperCase()] : acc, []).join('').slice(0, 2) || '–'}
            </div>
            <span className="text-xs font-medium text-gray-800">{nomeUsuario.split(' ')[0]}</span>
          </div>
        )}
      </div>

      {/* Row 1: KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Ativos nos postos', valor: kpis.ativos, cor: 'border-t-blue-500', icon: <MapPin className="h-4 w-4 text-blue-400" /> },
          { label: 'De atestado', valor: kpis.atestados, cor: 'border-t-amber-500', icon: <Stethoscope className="h-4 w-4 text-amber-400" /> },
          { label: 'De férias', valor: kpis.ferias, cor: 'border-t-green-500', icon: <Palmtree className="h-4 w-4 text-green-400" /> },
          { label: 'Postos descobertos', valor: kpis.descobertos, cor: 'border-t-red-500', icon: <ShieldAlert className="h-4 w-4 text-red-400" /> },
        ].map(({ label, valor, cor, icon }) => (
          <div key={label} className={cn('rounded-xl border border-gray-100 border-t-4 bg-white p-4 shadow-sm flex flex-col justify-between min-h-[100px]', cor)}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-3xl font-black text-gray-900">{valor}</p>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
              </div>
              {icon}
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: Postos com ocorrências | Mini-KPIs */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">

        {/* Postos com ocorrências — 2/3 */}
        <div className="lg:col-span-2 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Meus postos — ocorrências</p>
          {postosComProblema.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <p className="text-sm font-medium text-green-700">Todos os postos em ordem</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {postosComProblema.map(p => <PostoMiniCard key={p.id} posto={p} />)}
            </div>
          )}
          {postosOk.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {postosOk.map(p => (
                <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  {p.nome}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Mini-KPIs — 1/3 */}
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Indicadores</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Coberturas ativas', valor: kpis.coberturas_ativas, href: '/coberturas' },
                { label: 'Aprovações pend.', valor: kpis.aprovacoes, href: '/aprovacoes' },
                { label: 'Ocorrências mês', valor: kpis.ocorrencias, href: '/ocorrencias' },
                { label: 'Total de postos', valor: postos.length, href: undefined },
              ].map(({ label, valor, href }) => {
                const inner = (
                  <div className={cn('rounded-lg border border-gray-100 bg-gray-50 p-3', href && 'cursor-pointer hover:bg-gray-100 transition-colors')}>
                    <p className="text-2xl font-black text-gray-900">{valor}</p>
                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
                  </div>
                )
                return href ? <Link key={label} href={href}>{inner}</Link> : <div key={label}>{inner}</div>
              })}
            </div>
          </div>

          {/* Próximas férias */}
          {proximasFerias.length > 0 && (
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Próximas férias — 14 dias</p>
              <div className="flex flex-col gap-2">
                {proximasFerias.slice(0, 4).map(f => (
                  <div key={f.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-gray-800">{f.funcionario_nome.split(' ')[0]} {f.funcionario_nome.split(' ').slice(-1)[0]}</p>
                      {f.posto_nome && <p className="truncate text-[10px] text-gray-400">{f.posto_nome}</p>}
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                      {fmtDate(f.data_inicio)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Atestados ativos | Coberturas ativas */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">

        {/* Atestados ativos */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-amber-500" />
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Atestados em aberto</p>
          </div>
          {atestadosAtivos.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <p className="text-sm text-green-700">Nenhum atestado ativo</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-gray-50">
              {atestadosAtivos.map(a => (
                <div key={a.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-800">{a.funcionario_nome}</p>
                    {a.posto_nome && <p className="truncate text-xs text-gray-400">{a.posto_nome}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold text-gray-700">até {fmtDate(a.data_fim)}</p>
                    <p className={cn('text-[10px] font-medium', a.dias_restantes <= 2 ? 'text-red-600' : a.dias_restantes <= 5 ? 'text-amber-600' : 'text-gray-400')}>
                      {a.dias_restantes === 0 ? 'vence hoje' : a.dias_restantes === 1 ? 'vence amanhã' : `${a.dias_restantes} dias`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coberturas ativas */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Repeat2 className="h-4 w-4 text-indigo-500" />
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Coberturas em andamento</p>
          </div>
          {coberturas.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
              <Clock className="h-4 w-4 text-gray-400" />
              <p className="text-sm text-gray-500">Nenhuma cobertura ativa</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-gray-50">
              {coberturas.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-gray-500">
                      <span className="font-semibold text-gray-800">{c.substituto_nome.split(' ')[0]}</span>
                      {' cobre '}
                      <span className="font-medium text-gray-700">{c.ausente_nome.split(' ')[0]}</span>
                    </p>
                    {c.posto_nome && <p className="truncate text-[10px] text-gray-400">{c.posto_nome}</p>}
                  </div>
                  {c.data_prevista_retorno && (
                    <span className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                      c.venceHoje ? 'bg-red-50 text-red-700 ring-red-200' :
                      c.venceAmanha ? 'bg-amber-50 text-amber-700 ring-amber-200' :
                      'bg-gray-50 text-gray-600 ring-gray-200'
                    )}>
                      {c.venceHoje ? 'vence hoje' : c.venceAmanha ? 'vence amanhã' : fmtDate(c.data_prevista_retorno)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
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

  const authEarly = await getUser()
  if (!authEarly) return null

  // ── Supervisor: dashboard filtrado aos seus postos ──────────────────────────
  if (authEarly.perfil.role === 'supervisor') {
    await processarRetornosAtestado()
    const dados = await buscarDadosSupervisor(authEarly.user.id, 14)
    const nomeUsuario = authEarly.perfil.nome ?? ''
    const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    return <SupervisorDashboard dados={dados} nomeUsuario={nomeUsuario} hoje={hoje} />
  }

  const supabase = createClient()

  // Processa retornos silenciosamente a cada carregamento do dashboard
  const retornos = await processarRetornosAtestado()

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

      {/* ── Banner retornos automáticos ─────────────────────────────────────── */}
      {retornos.processados > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <span className="mt-0.5 text-green-600">✓</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-green-800">
              {retornos.processados} funcionário{retornos.processados > 1 ? 's retornaram' : ' retornou'} automaticamente ao ativo
            </p>
            <p className="mt-0.5 truncate text-xs text-green-700">
              {retornos.nomes.slice(0, 5).join(', ')}{retornos.nomes.length > 5 ? ` e mais ${retornos.nomes.length - 5}` : ''}
            </p>
          </div>
        </div>
      )}

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
