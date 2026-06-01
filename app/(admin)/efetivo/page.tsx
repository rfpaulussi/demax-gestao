import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { FuncionariosTable } from '@/components/efetivo/funcionarios-table'
import { FiltrosEfetivo } from '@/components/efetivo/filtros-efetivo'
import type { FuncionarioRow } from '@/components/efetivo/funcionarios-table'

// ─── counter card ─────────────────────────────────────────────────────────────

function CounterCard({
  label,
  value,
  topColor,
}: {
  label: string
  value: number
  topColor: string
}) {
  return (
    <div className={`rounded-xl border border-gray-100 border-t-4 bg-white p-5 shadow-sm ${topColor}`}>
      <p className="text-4xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">
        {label}
      </p>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

type SearchParams = {
  secretaria?: string
  status?: string
  busca?: string
}

export default async function EfetivoPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = createClient()

  const { data: raw } = await supabase
    .from('funcionarios')
    .select(`
      id, nome, cpf, status, data_admissao, posto_id,
      funcoes!funcao_id ( id, nome ),
      postos!posto_id ( id, nome, secretaria )
    `)
    .order('nome')

  const funcionarios = (raw ?? []) as unknown as FuncionarioRow[]

  // Counters over unfiltered data
  const total     = funcionarios.length
  const ativos    = funcionarios.filter(f => f.status === 'ativo').length
  const afastados = funcionarios.filter(f => f.status === 'afastado').length
  const emFerias  = funcionarios.filter(f => f.status === 'ferias').length

  // Distinct secretarias for the filter select
  const secretarias = Array.from(
    new Set(
      funcionarios
        .map(f => f.postos?.secretaria)
        .filter((s): s is string => Boolean(s)),
    ),
  ).sort()

  // Apply search-param filters
  const { busca, status, secretaria } = searchParams
  let filtered = funcionarios

  if (busca) {
    const q = busca.toLowerCase()
    filtered = filtered.filter(f => f.nome.toLowerCase().includes(q))
  }
  if (status) {
    filtered = filtered.filter(f => f.status === status)
  }
  if (secretaria) {
    filtered = filtered.filter(f => f.postos?.secretaria === secretaria)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Efetivo</h1>
        <p className="text-sm text-gray-400">Gestão do quadro de funcionários</p>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <CounterCard label="Total"      value={total}     topColor="border-t-gray-400"   />
        <CounterCard label="Ativos"     value={ativos}    topColor="border-t-green-500"  />
        <CounterCard label="Afastados"  value={afastados} topColor="border-t-red-500"    />
        <CounterCard label="Em Férias"  value={emFerias}  topColor="border-t-orange-500" />
      </div>

      {/* Filters — wrapped in Suspense because useSearchParams() requires it */}
      <Suspense>
        <FiltrosEfetivo secretarias={secretarias} />
      </Suspense>

      {/* Table */}
      <FuncionariosTable funcionarios={filtered} />
    </div>
  )
}
