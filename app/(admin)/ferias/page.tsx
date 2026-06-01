import { createClient } from '@/lib/supabase/server'
import { FeriasTable } from '@/components/ferias/ferias-table'
import type { FeriasRow } from '@/components/ferias/ferias-table'

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
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

type SearchParams = {
  status?: string
  secretaria?: string
}

export default async function FeriasPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = createClient()

  const { data: raw } = await supabase
    .from('ferias')
    .select(`
      id, status, data_inicio, data_fim, observacao,
      funcionarios!funcionario_id (
        id, nome, posto_id,
        postos!posto_id ( nome, secretaria )
      )
    `)
    .order('data_inicio', { ascending: false })

  const ferias = (raw ?? []) as FeriasRow[]

  const total     = ferias.length
  const agendadas = ferias.filter(f => f.status === 'agendada').length
  const emCurso   = ferias.filter(f => f.status === 'em_curso').length
  const concluidas = ferias.filter(f => f.status === 'concluida').length

  const secretarias = Array.from(
    new Set(
      ferias
        .map(f => f.funcionarios?.postos?.secretaria)
        .filter((s): s is string => Boolean(s)),
    ),
  ).sort()

  let filtered = ferias

  if (searchParams.status) {
    filtered = filtered.filter(f => f.status === searchParams.status)
  }
  if (searchParams.secretaria) {
    filtered = filtered.filter(
      f => f.funcionarios?.postos?.secretaria === searchParams.secretaria,
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Férias</h1>
        <p className="text-sm text-gray-400">Gestão de férias do quadro de funcionários</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <CounterCard label="Total"      value={total}      topColor="border-t-gray-400"   />
        <CounterCard label="Agendadas"  value={agendadas}  topColor="border-t-yellow-500" />
        <CounterCard label="Em Curso"   value={emCurso}    topColor="border-t-blue-500"   />
        <CounterCard label="Concluídas" value={concluidas} topColor="border-t-green-500"  />
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Status
          </label>
          <select
            name="status"
            defaultValue={searchParams.status ?? ''}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
          >
            <option value="">Todos</option>
            <option value="agendada">Agendada</option>
            <option value="em_curso">Em Curso</option>
            <option value="concluida">Concluída</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Secretaria
          </label>
          <select
            name="secretaria"
            defaultValue={searchParams.secretaria ?? ''}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
          >
            <option value="">Todas</option>
            {secretarias.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="h-9 rounded-lg bg-gray-900 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-gray-700"
        >
          Filtrar
        </button>
        <a
          href="/ferias"
          className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-400 hover:bg-gray-50"
        >
          Limpar
        </a>
      </form>

      <FeriasTable ferias={filtered} />
    </div>
  )
}
