import { createClient } from '@/lib/supabase/server'
import { AdvertenciasTable } from '@/components/advertencias/advertencias-table'
import type { AdvertenciaRow } from '@/components/advertencias/advertencias-table'
import { cn } from '@/lib/utils'

// ─── style constants ──────────────────────────────────────────────────────────

const inputClass =
  'flex h-9 rounded-lg border border-gray-200 bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

// ─── counter card ─────────────────────────────────────────────────────────────

function CounterCard({
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
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function AdvertenciasPage({
  searchParams,
}: {
  searchParams: { busca?: string; status?: string }
}) {
  const supabase = createClient()

  const { data: raw } = await supabase
    .from('advertencias')
    .select(`
      id, tipo, data_ocorrencia, status, pdf_url, descricao,
      funcionarios!funcionario_id (
        id, nome,
        postos!posto_id ( nome, secretaria )
      )
    `)
    .order('data_ocorrencia', { ascending: false })

  const all = (raw ?? []) as AdvertenciaRow[]

  // Counts (before filtering)
  const total     = all.length
  const pendentes = all.filter(a => a.status === 'pendente').length
  const geradas   = all.filter(a => a.status === 'gerada').length
  const entregues = all.filter(a => a.status === 'entregue').length

  // Apply filters
  const buscaLower = searchParams.busca?.toLowerCase() ?? ''
  const statusFilter = searchParams.status ?? ''

  const filtered = all.filter(a => {
    const matchBusca = buscaLower
      ? (a.funcionarios?.nome ?? '').toLowerCase().includes(buscaLower)
      : true
    const matchStatus = statusFilter ? a.status === statusFilter : true
    return matchBusca && matchStatus
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-gray-900">Advertências</h1>
        <p className="text-sm text-gray-400">Registro e acompanhamento de advertências</p>
      </div>

      {/* Counter cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <CounterCard label="Total"     value={total}     borderColor="border-t-gray-400"   />
        <CounterCard label="Pendentes" value={pendentes} borderColor="border-t-yellow-500" />
        <CounterCard label="Geradas"   value={geradas}   borderColor="border-t-blue-500"   />
        <CounterCard label="Entregues" value={entregues} borderColor="border-t-green-500"  />
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
          className="flex h-9 items-center rounded-lg bg-gray-900 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-700"
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
      <AdvertenciasTable advertencias={filtered} />
    </div>
  )
}
