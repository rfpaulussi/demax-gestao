import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { cn } from '@/lib/utils'
import { AdvertenciasTable } from '@/components/advertencias/advertencias-table'
import { NovaAdvertenciaBtn } from '@/components/advertencias/nova-advertencia-btn'
import {
  buscarAdvertencias,
  buscarFuncionariosAtivos,
  buscarSupervisoresParaAdvertencia,
} from '@/app/(admin)/advertencias/actions'

const inputClass =
  'flex h-9 rounded-lg border border-gray-200 bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

function KpiCard({
  label,
  value,
  borderColor,
}: {
  label: string
  value: number
  borderColor: string
}) {
  return (
    <div className={cn('rounded-xl border border-gray-100 border-t-4 bg-white p-5 shadow-sm', borderColor)}>
      <p className="text-3xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

export default async function AdvertenciasPage({
  searchParams,
}: {
  searchParams: { busca?: string; status?: string; grau?: string }
}) {
  const auth = await getUser()
  if (!auth) redirect('/login')

  const [all, funcionarios, supervisores] = await Promise.all([
    buscarAdvertencias(),
    buscarFuncionariosAtivos(),
    buscarSupervisoresParaAdvertencia(),
  ])

  const reincidencias: Record<string, number> = {}
  for (const a of all) {
    reincidencias[a.funcionario_id] = (reincidencias[a.funcionario_id] ?? 0) + 1
  }

  const total     = all.length
  const pendentes = all.filter(a => a.status === 'pendente').length
  const geradas   = all.filter(a => a.status === 'gerada').length
  const entregues = all.filter(a => a.status === 'entregue').length

  const buscaLower  = searchParams.busca?.toLowerCase() ?? ''
  const statusFilter = searchParams.status ?? ''
  const grauFilter   = searchParams.grau ?? ''

  let filtered = all
  if (buscaLower)   filtered = filtered.filter(a => (a.funcionarios?.nome ?? '').toLowerCase().includes(buscaLower))
  if (statusFilter) filtered = filtered.filter(a => a.status === statusFilter)
  if (grauFilter)   filtered = filtered.filter(a => (a.grau ?? a.tipo) === grauFilter)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Advertências</h1>
          <p className="text-sm text-gray-400">Registro e acompanhamento de medidas disciplinares</p>
        </div>
        <NovaAdvertenciaBtn funcionarios={funcionarios} supervisores={supervisores} reincidencias={reincidencias} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total"     value={total}     borderColor="border-t-gray-400"   />
        <KpiCard label="Pendentes" value={pendentes} borderColor="border-t-amber-500"  />
        <KpiCard label="Geradas"   value={geradas}   borderColor="border-t-blue-500"   />
        <KpiCard label="Entregues" value={entregues} borderColor="border-t-green-500"  />
      </div>

      {/* Filters */}
      <form method="get" className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          name="busca"
          defaultValue={searchParams.busca}
          placeholder="Buscar funcionário..."
          className={cn(inputClass, 'w-56')}
        />
        <select
          name="grau"
          defaultValue={searchParams.grau}
          className={cn(inputClass, 'w-44')}
        >
          <option value="">Todos os graus</option>
          <option value="verbal">Verbal</option>
          <option value="escrita">Escrita</option>
          <option value="suspensao">Suspensão</option>
        </select>
        <select
          name="status"
          defaultValue={searchParams.status}
          className={cn(inputClass, 'w-40')}
        >
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="gerada">Gerada</option>
          <option value="entregue">Entregue</option>
        </select>
        <button
          type="submit"
          className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          Filtrar
        </button>
        <a
          href="/advertencias"
          className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
        >
          Limpar
        </a>
      </form>

      {/* Table */}
      <AdvertenciasTable advertencias={filtered} reincidencias={reincidencias} supervisores={supervisores} />

    </div>
  )
}
