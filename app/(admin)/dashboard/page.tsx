import { Users, ArrowLeftRight, TrendingDown, FileMinus, type LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

// ─── types ───────────────────────────────────────────────────────────────────

type CoberturaRow = {
  id: string
  motivo: string | null
  data_inicio: string | null
  data_prev_retorno: string | null
  funcionarios: { nome: string } | null
  posto_destino: { nome: string } | null
}

type AtestadoRow = {
  id: string
  data_inicio: string
  data_fim: string
  motivo: string | null
  funcionarios: { nome: string } | null
  postos: { nome: string } | null
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

type UrgKey = 'red' | 'orange' | 'purple'

const URGENCY: Record<UrgKey, { label: string; dot: string; badge: string }> = {
  red:    { label: 'Urgente', dot: 'bg-red-500',    badge: 'bg-red-50 text-red-700 ring-red-200'       },
  orange: { label: 'Atenção', dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 ring-orange-200' },
  purple: { label: 'Normal',  dot: 'bg-purple-500', badge: 'bg-purple-50 text-purple-700 ring-purple-200' },
}

function urgency(dataPrevRetorno: string | null, tomorrow: Date, in3Days: Date): UrgKey {
  if (!dataPrevRetorno) return 'purple'
  const [y, m, d] = dataPrevRetorno.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (dt <= tomorrow) return 'red'
  if (dt <= in3Days) return 'orange'
  return 'purple'
}

// ─── KPI card ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  topColor,
  iconColor,
}: {
  label: string
  value: number
  icon: LucideIcon
  topColor: string  // e.g. 'border-t-blue-500'
  iconColor: string // e.g. 'text-blue-600 bg-blue-50'
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-gray-100 border-t-4 bg-white p-5 shadow-sm',
        topColor,
      )}
    >
      <div className={cn('inline-flex rounded-lg p-2.5', iconColor.split(' ')[1])}>
        <Icon className={cn('h-5 w-5', iconColor.split(' ')[0])} />
      </div>
      <p className="mt-3 text-4xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">
        {label}
      </p>
    </div>
  )
}

// ─── section heading ─────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
      {children}
    </h2>
  )
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = createClient()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const tomorrowDate = new Date(todayDate.getTime() + 86_400_000)
  const in3DaysDate = new Date(todayDate.getTime() + 3 * 86_400_000)

  const [
    { count: totalAtivos },
    { count: coberturasCount },
    { data: postosData },
    { data: funcPosto },
    { data: atestadosData },
    { data: coberturasData },
  ] = await Promise.all([
    supabase
      .from('funcionarios')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ativo'),

    supabase
      .from('coberturas_temporarias')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ativa'),

    supabase
      .from('postos')
      .select('id, efetivo_previsto')
      .eq('ativo', true)
      .not('efetivo_previsto', 'is', null)
      .gt('efetivo_previsto', 0),

    supabase
      .from('funcionarios')
      .select('posto_id')
      .eq('status', 'ativo')
      .not('posto_id', 'is', null),

    supabase
      .from('atestados')
      .select(`
        id, data_inicio, data_fim, motivo,
        funcionarios!funcionario_id ( nome ),
        postos!posto_id ( nome )
      `)
      .eq('data_inicio', todayStr)
      .order('created_at', { ascending: false }),

    supabase
      .from('coberturas_temporarias')
      .select(`
        id, motivo, data_inicio, data_prev_retorno,
        funcionarios!funcionario_id ( nome ),
        posto_destino:postos!posto_destino_id ( nome )
      `)
      .eq('status', 'ativa')
      .order('data_prev_retorno', { ascending: true, nullsFirst: false }),
  ])

  // Postos em déficit: compare efetivo_previsto vs funcionários ativos por posto
  const porPosto: Record<string, number> = {}
  funcPosto?.forEach(f => {
    if (f.posto_id) porPosto[f.posto_id] = (porPosto[f.posto_id] ?? 0) + 1
  })
  const deficit =
    postosData?.filter(p => (porPosto[p.id] ?? 0) < (p.efetivo_previsto ?? 0)).length ?? 0

  const coberturas = (coberturasData as unknown as CoberturaRow[]) ?? []
  const atestados = (atestadosData as unknown as AtestadoRow[]) ?? []

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionTitle>Visão geral</SectionTitle>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Funcionários Ativos"
            value={totalAtivos ?? 0}
            icon={Users}
            topColor="border-t-blue-500"
            iconColor="text-blue-600 bg-blue-50"
          />
          <KpiCard
            label="Coberturas Ativas"
            value={coberturasCount ?? 0}
            icon={ArrowLeftRight}
            topColor="border-t-orange-500"
            iconColor="text-orange-600 bg-orange-50"
          />
          <KpiCard
            label="Postos em Déficit"
            value={deficit}
            icon={TrendingDown}
            topColor="border-t-red-500"
            iconColor="text-red-600 bg-red-50"
          />
          <KpiCard
            label="Atestados Hoje"
            value={atestados.length}
            icon={FileMinus}
            topColor="border-t-amber-500"
            iconColor="text-amber-600 bg-amber-50"
          />
        </div>
      </section>

      {/* ── Coberturas table ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionTitle>Coberturas temporárias ativas</SectionTitle>
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {coberturas.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-gray-400">
              Nenhuma cobertura ativa.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr>
                    {['Funcionário', 'Posto destino', 'Motivo', 'Início', 'Prev. retorno', 'Status'].map(h => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {coberturas.map(c => {
                    const urg = urgency(c.data_prev_retorno, tomorrowDate, in3DaysDate)
                    const { label, dot, badge } = URGENCY[urg]
                    return (
                      <tr key={c.id} className="transition-colors hover:bg-gray-50">
                        <td className="px-5 py-3.5 font-medium text-gray-900">
                          {c.funcionarios?.nome ?? '—'}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">
                          {c.posto_destino?.nome ?? '—'}
                        </td>
                        <td className="max-w-44 truncate px-5 py-3.5 text-gray-500">
                          {c.motivo ?? '—'}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">
                          {c.data_inicio ? fmt(c.data_inicio) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">
                          {c.data_prev_retorno ? fmt(c.data_prev_retorno) : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                              badge,
                            )}
                          >
                            <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
                            {label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── Atestados do dia ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionTitle>Atestados de hoje</SectionTitle>
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {atestados.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-gray-400">
              Nenhum atestado registrado hoje.
            </p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {atestados.map(a => (
                <li key={a.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {a.funcionarios?.nome ?? '—'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {a.postos?.nome ?? 'Posto não informado'}
                    </p>
                  </div>
                  <div className="text-right">
                    {a.motivo && (
                      <p className="max-w-48 truncate text-xs text-gray-500">{a.motivo}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {fmt(a.data_inicio)}
                      {a.data_fim !== a.data_inicio ? ` → ${fmt(a.data_fim)}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

    </div>
  )
}
