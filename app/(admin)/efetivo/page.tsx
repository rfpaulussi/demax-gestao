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
  supervisor?: string
}

type ConfigRow = {
  supervisor_id: string
  posto_id: string
  perfis: { id: string; nome: string | null } | null
}

export default async function EfetivoPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = createClient()

  const [{ data: raw }, { data: supervisoresRaw }, { data: configRaw }] = await Promise.all([
    supabase
      .from('funcionarios')
      .select(`
        id, nome, cpf, status, data_admissao, posto_id,
        funcoes!funcao_id ( id, nome ),
        postos!posto_id ( id, nome, secretaria )
      `)
      .order('nome'),
    supabase
      .from('perfis')
      .select('id, nome')
      .eq('role', 'supervisor')
      .eq('ativo', true)
      .order('nome'),
    supabase
      .from('config_supervisores_postos')
      .select('supervisor_id, posto_id, perfis!supervisor_id(id, nome)')
      .eq('ativo', true),
  ])

  const funcionarios = (raw ?? []) as unknown as FuncionarioRow[]

  // supervisor_id → Set<posto_id>  (for filtering by supervisor)
  const supervisorPostoMap = new Map<string, Set<string>>()
  // posto_id → { id, nomeCompleto }  (for enriching display)
  const postoSupervisorMap = new Map<string, { id: string; nomeCompleto: string }>()

  for (const row of (configRaw ?? []) as unknown as ConfigRow[]) {
    if (!supervisorPostoMap.has(row.supervisor_id)) {
      supervisorPostoMap.set(row.supervisor_id, new Set())
    }
    supervisorPostoMap.get(row.supervisor_id)!.add(row.posto_id)

    const nomeCompleto = row.perfis?.nome
    if (nomeCompleto && !postoSupervisorMap.has(row.posto_id)) {
      postoSupervisorMap.set(row.posto_id, { id: row.supervisor_id, nomeCompleto })
    }
  }

  const supervisedPostoIds = new Set(
    ((configRaw ?? []) as unknown as ConfigRow[]).map(r => r.posto_id),
  )

  // Counters over unfiltered data (for KPI cards — unchanged)
  const total     = funcionarios.length
  const ativos    = funcionarios.filter(f => f.status === 'ativo').length
  const afastados = funcionarios.filter(f => f.status === 'afastado').length
  const emFerias  = funcionarios.filter(f => f.status === 'ferias').length

  // Distinct secretarias for filter select
  const secretarias = Array.from(
    new Set(
      funcionarios
        .map(f => f.postos?.secretaria)
        .filter((s): s is string => Boolean(s)),
    ),
  ).sort()

  // Counts for filter dropdowns
  const supervisorCounts: Record<string, number> = {}
  let semSupervisorCount = 0
  for (const f of funcionarios) {
    const sup = f.posto_id ? postoSupervisorMap.get(f.posto_id) : undefined
    if (sup) {
      supervisorCounts[sup.id] = (supervisorCounts[sup.id] ?? 0) + 1
    } else {
      semSupervisorCount++
    }
  }

  const secretariaCounts: Record<string, number> = {}
  for (const f of funcionarios) {
    const s = f.postos?.secretaria
    if (s) secretariaCounts[s] = (secretariaCounts[s] ?? 0) + 1
  }

  const statusCounts: Record<string, number> = {}
  for (const f of funcionarios) {
    if (f.status) statusCounts[f.status] = (statusCounts[f.status] ?? 0) + 1
  }

  // Apply search-param filters
  const { busca, status, secretaria, supervisor } = searchParams
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
  if (supervisor === 'sem_supervisor') {
    filtered = filtered.filter(f => !f.posto_id || !supervisedPostoIds.has(f.posto_id))
  } else if (supervisor) {
    const postosDoSup = supervisorPostoMap.get(supervisor) ?? new Set<string>()
    filtered = filtered.filter(f => !!f.posto_id && postosDoSup.has(f.posto_id))
  }

  // Enrich each row with supervisor_nome resolved from posto_id
  const enriched: FuncionarioRow[] = filtered.map(f => ({
    ...f,
    supervisor_nome: f.posto_id
      ? (postoSupervisorMap.get(f.posto_id)?.nomeCompleto ?? null)
      : null,
  }))

  const supervisores = (supervisoresRaw ?? []) as { id: string; nome: string | null }[]

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

      {/* Filters */}
      <Suspense>
        <FiltrosEfetivo
          secretarias={secretarias}
          supervisores={supervisores}
          supervisorCounts={supervisorCounts}
          secretariaCounts={secretariaCounts}
          statusCounts={statusCounts}
          semSupervisorCount={semSupervisorCount}
        />
      </Suspense>

      {/* Table */}
      <FuncionariosTable funcionarios={enriched} />
    </div>
  )
}
