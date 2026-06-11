import { createClient } from '@/lib/supabase/server'
import { EfetivoClient } from '@/components/efetivo/efetivo-client'
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

// ─── types ────────────────────────────────────────────────────────────────────

type ConfigRow = {
  supervisor_id: string
  posto_id: string
  perfis: { id: string; nome: string | null } | null
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function EfetivoPage() {
  const supabase = createClient()

  const [
    { data: raw },
    { data: supervisoresRaw },
    { data: configRaw },
    { data: postosRaw },
    { data: funcoesRaw },
  ] = await Promise.all([
    supabase
      .from('funcionarios')
      .select(`
        id, nome, cpf, status, data_admissao, posto_id,
        funcoes!funcao_id ( id, nome ),
        postos!posto_id ( id, nome, secretaria )
      `)
      .order('nome')
      .range(0, 1499),
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
    supabase.from('postos').select('id, nome, secretaria').order('nome'),
    supabase.from('funcoes').select('id, nome').order('nome'),
  ])

  // posto_id → { supervisor_id, nomeCompleto }
  const postoSupervisorMap = new Map<string, { id: string; nomeCompleto: string }>()
  for (const row of (configRaw ?? []) as unknown as ConfigRow[]) {
    const nome = row.perfis?.nome
    if (nome && !postoSupervisorMap.has(row.posto_id)) {
      postoSupervisorMap.set(row.posto_id, { id: row.supervisor_id, nomeCompleto: nome })
    }
  }

  // Enrich ALL funcionarios with supervisor_nome + supervisor_id
  const funcionarios = ((raw ?? []) as unknown as FuncionarioRow[]).map(f => {
    const sup = f.posto_id ? postoSupervisorMap.get(f.posto_id) : undefined
    return {
      ...f,
      supervisor_nome: sup?.nomeCompleto ?? null,
      supervisor_id:   sup?.id ?? null,
    }
  })

  // KPI counters (always over full list)
  const total     = funcionarios.length
  const ativos    = funcionarios.filter(f => f.status === 'ativo').length
  const afastados = funcionarios.filter(f => f.status === 'afastado').length
  const emFerias  = funcionarios.filter(f => f.status === 'ferias').length

  const supervisores = (supervisoresRaw ?? []) as { id: string; nome: string | null }[]
  const postos       = (postosRaw ?? []) as { id: string; nome: string; secretaria: string | null }[]
  const funcoes      = (funcoesRaw ?? []) as { id: string; nome: string }[]

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

      {/* Filters + Table (client-side) */}
      <EfetivoClient
        funcionarios={funcionarios}
        supervisores={supervisores}
        postos={postos}
        funcoes={funcoes}
      />
    </div>
  )
}
