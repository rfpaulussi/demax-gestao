import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'
import { cn } from '@/lib/utils'
import { buscarInsalubridades, buscarFuncionariosParaDeclaracao } from './actions'
import { InsalubridadeTable } from '@/components/insalubridade/insalubridade-table'
import { ImportarCoberturasBtn } from '@/components/insalubridade/importar-coberturas-btn'

const sel = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

function KpiCard({ label, value, borderColor }: { label: string; value: number; borderColor: string }) {
  return (
    <div className={cn('rounded-xl border border-gray-100 border-t-4 bg-white p-5 shadow-sm', borderColor)}>
      <p className="text-3xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

export default async function InsalubridadePage({
  searchParams,
}: {
  searchParams: { mes?: string; ano?: string; status?: string; secretaria?: string }
}) {
  const now  = new Date()
  const mes  = Number(searchParams.mes  ?? now.getMonth() + 1)
  const ano  = Number(searchParams.ano  ?? now.getFullYear())

  const [grupos, funcionariosOpt, auth] = await Promise.all([
    buscarInsalubridades(mes, ano, {
      status:     searchParams.status,
      secretaria: searchParams.secretaria,
    }),
    buscarFuncionariosParaDeclaracao(),
    getUser(),
  ])

  const supabasePostos = createClient()
  let postos: { id: string; nome: string; secretaria: string | null }[] = []
  if (auth?.perfil.role === 'admin') {
    const { data } = await supabasePostos
      .from('postos')
      .select('id, nome, secretaria')
      .eq('ativo', true)
      .order('nome')
    postos = (data ?? []) as { id: string; nome: string; secretaria: string | null }[]
  } else if (auth) {
    const { data: cfgData } = await supabasePostos
      .from('config_supervisores_postos')
      .select('posto_id')
      .eq('supervisor_id', auth.user.id)
      .eq('ativo', true)
    const postoIds = (cfgData ?? []).map((r: { posto_id: string }) => r.posto_id)
    if (postoIds.length > 0) {
      const { data } = await supabasePostos
        .from('postos')
        .select('id, nome, secretaria')
        .in('id', postoIds)
        .order('nome')
      postos = (data ?? []) as { id: string; nome: string; secretaria: string | null }[]
    }
  }

  // KPI data (sem filtro de status/secretaria para contar totais do mês)
  const supabase = supabasePostos
  const { data: kpiRaw } = await supabase
    .from('insalubridade_coberturas')
    .select('status, funcionario_id')
    .eq('mes', mes)
    .eq('ano', ano)

  const kpiAll = kpiRaw ?? []
  const kpiPendentes  = kpiAll.filter(r => r.status === 'pendente').length
  const kpiEnviados   = kpiAll.filter(r => r.status === 'enviado').length
  const kpiFuncionarios = new Set(kpiAll.map(r => r.funcionario_id)).size

  // Secretarias for filter
  const secretarias = Array.from(
    new Set(grupos.map(g => g.secretaria).filter((s): s is string => Boolean(s)))
  ).sort()

  const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const anos  = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Insalubridade</h1>
          <p className="text-sm text-gray-400">Coberturas insalubres — {MESES[mes]} {ano}</p>
        </div>
        <ImportarCoberturasBtn mes={mes} ano={ano} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Pendentes"          value={kpiPendentes}   borderColor="border-t-amber-500"  />
        <KpiCard label="Enviados no Mês"    value={kpiEnviados}    borderColor="border-t-green-500"  />
        <KpiCard label="Func. com Cobertura" value={kpiFuncionarios} borderColor="border-t-purple-500" />
      </div>

      {/* Filters */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Mês</label>
          <select name="mes" defaultValue={mes} className={sel}>
            {MESES.slice(1).map((m, i) => (
              <option key={i+1} value={i+1}>{m}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Ano</label>
          <select name="ano" defaultValue={ano} className={sel}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Status</label>
          <select name="status" defaultValue={searchParams.status ?? ''} className={sel}>
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="enviado">Enviado</option>
            <option value="pago">Pago</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Secretaria</label>
          <select name="secretaria" defaultValue={searchParams.secretaria ?? ''} className={sel}>
            <option value="">Todas</option>
            {secretarias.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button type="submit" className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700">
          Filtrar
        </button>
        <a href="/insalubridade" className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50">
          Limpar
        </a>
      </form>

      {/* Table */}
      <InsalubridadeTable
        grupos={grupos}
        mes={mes}
        ano={ano}
        funcionariosOpt={funcionariosOpt}
        postos={postos}
      />

    </div>
  )
}
