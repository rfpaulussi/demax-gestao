import Link from 'next/link'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
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
import type { DadosSupervisor } from './actions'
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
  const [, m, dd] = d.split('-')
  return `${dd}/${m}`
}

function fmtDateFull(d: string) {
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}

function SupervisorDashboard({ dados, nomeUsuario }: { dados: DadosSupervisor; nomeUsuario: string }) {
  const { kpis, postos, coberturas, proximasFerias, atestadosRecentes, postosDeficit } = dados
  const totalAusentes = kpis.atestados + kpis.afastados + kpis.ferias + kpis.faltantes

  const iniciais = nomeUsuario.trim().split(/\s+/).filter(Boolean)
    .reduce((acc: string[], p, i, arr) => i === 0 || i === arr.length - 1 ? [...acc, p[0].toUpperCase()] : acc, [])
    .join('').slice(0, 2) || '–'

  return (
    <div className="space-y-3">
      {/* ── Topbar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          {nomeUsuario && (
            <>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
                {iniciais}
              </div>
              <span className="text-xs font-medium text-gray-800">{nomeUsuario.split(' ')[0]}</span>
            </>
          )}
        </div>
      </div>

      {/* ── Row 1: KPI Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCardPrincipal label="Efetivo Ativo"      valor={kpis.ativos}      corBorda="border-t-blue-500"  href="/efetivo?status=ativo"   />
        <KpiCardPrincipal label="Ausentes"           valor={totalAusentes}    corBorda="border-t-amber-500" aviso={(() => {
          const partes: string[] = []
          if (kpis.atestados > 0) partes.push(`${kpis.atestados} atestado${kpis.atestados > 1 ? 's' : ''}`)
          if (kpis.afastados > 0) partes.push(`${kpis.afastados} INSS`)
          if (kpis.faltantes > 0) partes.push(`${kpis.faltantes} faltante${kpis.faltantes > 1 ? 's' : ''}`)
          return partes.length > 0 ? partes.join(', ') : undefined
        })()} />
        <KpiCardPrincipal label="Em Férias"          valor={kpis.ferias}      corBorda="border-t-green-500" href="/efetivo?status=ferias" aviso={kpis.feriasAgendadas > 0 ? `${kpis.feriasAgendadas} agendada${kpis.feriasAgendadas > 1 ? 's' : ''}` : undefined} />
        <KpiCardPrincipal label="Postos em Déficit"  valor={postosDeficit.length} corBorda="border-t-red-500" criticos={kpis.descobertos > 0 ? kpis.descobertos : undefined} />
      </div>

      {/* ── Row 2: Alertas | Indicadores + Férias ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">

        {/* Alertas dos meus postos */}
        <div className="flex flex-col rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Alertas Críticos</p>
          {postosDeficit.length === 0 && kpis.descobertos === 0 ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-green-100 bg-green-50 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              <p className="text-sm font-medium text-green-700">Nenhum alerta crítico.</p>
            </div>
          ) : (
            <div className="flex-1 space-y-2 overflow-y-auto">
              {kpis.descobertos > 0 && (
                <div className="flex items-start gap-3 rounded-lg border-l-[3px] border-red-500 bg-red-50 px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <div>
                    <p className="text-xs font-semibold text-red-800">Posto sem cobertura</p>
                    <p className="text-xs text-red-700">{kpis.descobertos} posto{kpis.descobertos > 1 ? 's' : ''} com ausente sem substituto</p>
                  </div>
                </div>
              )}
              {postosDeficit.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-start gap-3 rounded-lg border-l-[3px] border-red-500 bg-red-50 px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-red-800">Posto em déficit</p>
                    <p className="truncate text-xs text-red-700">{p.nome} — falta{p.gap === 1 ? '' : 'm'} {p.gap} pessoa{p.gap > 1 ? 's' : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Indicadores + Próximas Férias */}
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Indicadores</p>
            <div className="grid grid-cols-2 gap-2">
              <KpiMini label="Aprovações Pend."  value={kpis.aprovacoes}       href="/aprovacoes" />
              <KpiMini label="Coberturas Ativas" value={kpis.coberturas_ativas} href="/coberturas" />
              <KpiMini label="Ocorrências Mês"   value={kpis.ocorrencias}       href="/ocorrencias" />
              <KpiMini label="Total de Postos"   value={postos.length} />
            </div>
          </div>

          {/* Próximas Férias */}
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Próximas Férias — 14 dias</p>
            {proximasFerias.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma férias nos próximos 14 dias.</p>
            ) : (
              <div className="space-y-2.5 max-h-40 overflow-y-auto">
                {proximasFerias.map(f => (
                  <div key={f.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[10px] font-bold text-orange-700">
                        {f.funcionario_nome.trim().split(/\s+/).filter(Boolean).reduce((a: string[], p, i, arr) =>
                          i === 0 || i === arr.length - 1 ? [...a, p[0].toUpperCase()] : a, []).join('')}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-gray-800">{f.funcionario_nome}</p>
                        {f.posto_nome && <p className="truncate text-[10px] text-gray-400">{f.posto_nome}</p>}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700 ring-1 ring-inset ring-orange-200">
                      {fmtDateFull(f.data_inicio)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 3: Efetivo por Posto ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">

        {/* Efetivo por Posto — tabela com barras */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">Efetivo por Posto</p>
          <ul className="max-h-80 space-y-2.5 overflow-y-auto">
            {[...postos].sort((a, b) => {
              const pctA = a.efetivo_previsto > 0 ? a.ativos / a.efetivo_previsto : 1
              const pctB = b.efetivo_previsto > 0 ? b.ativos / b.efetivo_previsto : 1
              return pctA - pctB
            }).map(p => {
              const pct = p.efetivo_previsto > 0 ? Math.round((p.ativos / p.efetivo_previsto) * 100) : 100
              const deficit = p.ativos < p.efetivo_previsto
              const excedente = p.ativos > p.efetivo_previsto
              const diff = p.ativos - p.efetivo_previsto
              const barColor = deficit ? (pct >= 80 ? 'bg-amber-500' : 'bg-red-500') : excedente ? 'bg-blue-400' : 'bg-green-500'
              const pctColor = deficit ? (pct >= 80 ? 'text-amber-600' : 'text-red-600') : excedente ? 'text-blue-600' : 'text-green-600'
              return (
                <li key={p.id}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-gray-700">{p.nome}</p>
                      {(p.atestados > 0 || p.afastados > 0 || p.ferias > 0 || p.insalubridade > 0) && (
                        <div className="mt-0.5 flex flex-wrap gap-1.5">
                          {p.atestados > 0 && <span className="text-[10px] font-medium text-amber-600">{p.atestados} atestado{p.atestados > 1 ? 's' : ''}</span>}
                          {p.afastados > 0 && <span className="text-[10px] font-medium text-red-600">{p.afastados} INSS</span>}
                          {p.ferias > 0 && <span className="text-[10px] font-medium text-blue-600">{p.ferias} férias</span>}
                          {p.insalubridade > 0 && <span className="text-[10px] font-medium text-purple-600">{p.insalubridade}/{p.cota_insalubridade} insalub.</span>}
                        </div>
                      )}
                    </div>
                    <p className="shrink-0 text-xs text-gray-500">
                      {p.ativos}/{p.efetivo_previsto}{' '}
                      <span className={cn('font-bold', pctColor)}>
                        {excedente ? `+${diff}` : deficit ? `-${p.efetivo_previsto - p.ativos}` : '✓'}
                      </span>
                    </p>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3 border-t border-gray-50 pt-3">
            {[
              { color: 'bg-green-500', label: 'Exato' },
              { color: 'bg-blue-400',  label: 'Excedente' },
              { color: 'bg-amber-500', label: 'Déficit leve (≥80%)' },
              { color: 'bg-red-500',   label: 'Déficit crítico' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', color)} />
                <span className="text-[10px] text-gray-400">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Coberturas ativas */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">Coberturas em Andamento</p>
          {coberturas.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              <p className="text-sm font-medium text-green-700">Nenhuma cobertura ativa.</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {coberturas.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-800">
                      {c.substituto_nome.split(' ')[0]} <span className="text-gray-400 font-normal text-xs">cobre</span> {c.ausente_nome.split(' ')[0]}
                    </p>
                    {c.posto_nome && <p className="truncate text-[11px] text-gray-400">{c.posto_nome}</p>}
                  </div>
                  {c.data_prevista_retorno && (
                    <span className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                      c.venceHoje   ? 'bg-red-50 text-red-700 ring-red-200' :
                      c.venceAmanha ? 'bg-amber-50 text-amber-700 ring-amber-200' :
                      'bg-gray-50 text-gray-600 ring-gray-200'
                    )}>
                      {c.venceHoje ? 'vence hoje' : c.venceAmanha ? 'vence amanhã' : fmtDateFull(c.data_prevista_retorno)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 4: Atestados Recentes ─────────────────────────────────────── */}
      {atestadosRecentes.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">Atestados Recentes — 30 dias</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {atestadosRecentes.map(a => (
              <div key={a.id} className="flex items-start gap-2.5 rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-medium text-indigo-700">
                  {a.funcionario_nome.trim().split(/\s+/).filter(Boolean).reduce((acc: string[], p, i, arr) =>
                    i === 0 || i === arr.length - 1 ? [...acc, p[0].toUpperCase()] : acc, []).join('').slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{a.funcionario_nome}</p>
                  {a.posto_nome && <p className="truncate text-xs text-gray-400">{a.posto_nome}</p>}
                  <p className="mt-0.5 text-xs text-gray-500">
                    {a.duracao} dia{a.duracao > 1 ? 's' : ''} · {fmtDate(a.data_inicio)}→{fmtDate(a.data_fim)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
    return <SupervisorDashboard dados={dados} nomeUsuario={nomeUsuario} />
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
          label="Postos c/ Problema"
          valor={kpis.postoVago + kpis.postoDeficit}
          corBorda="border-t-red-500"
          aviso={kpis.postoVago > 0 ? `${kpis.postoVago} vago${kpis.postoVago > 1 ? 's' : ''}` : undefined}
          criticos={kpis.postosCriticos}
        />
      </div>

      {/* ── Status dos Postos ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Status dos Postos</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-0.5 rounded-lg bg-red-50 px-3 py-2.5">
            <span className="text-2xl font-black text-red-600">{kpis.postoVago}</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-red-400">Vago</span>
            <span className="text-[10px] text-red-400">Nenhum alocado</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-lg bg-amber-50 px-3 py-2.5">
            <span className="text-2xl font-black text-amber-600">{kpis.postoDeficit}</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">Déficit</span>
            <span className="text-[10px] text-amber-400">Abaixo do previsto</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-lg bg-green-50 px-3 py-2.5">
            <span className="text-2xl font-black text-green-600">{kpis.postoOk}</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-green-400">OK</span>
            <span className="text-[10px] text-green-400">Efetivo exato</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-lg bg-blue-50 px-3 py-2.5">
            <span className="text-2xl font-black text-blue-600">{kpis.postoExcesso}</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-400">Excesso</span>
            <span className="text-[10px] text-blue-400">Acima do previsto</span>
          </div>
        </div>
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
