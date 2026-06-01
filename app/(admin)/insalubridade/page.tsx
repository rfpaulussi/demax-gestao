import { createClient } from '@/lib/supabase/server'
import { InsalubridadeTable } from '@/components/insalubridade/insalubridade-table'
import type { InsalubridadeRow } from '@/components/insalubridade/insalubridade-table'

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

export default async function InsalubridadePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = createClient()

  const { data: raw } = await supabase
    .from('coberturas_insalubres')
    .select(`
      id, grau, percentual, data_inicio, data_fim, status, declaracao_url,
      funcionarios!funcionario_id (
        id, nome,
        postos!posto_id ( id, nome, secretaria )
      )
    `)
    .order('data_inicio', { ascending: false })

  const registros = (raw ?? []) as InsalubridadeRow[]

  const now          = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const pendentes     = registros.filter(r => r.status === 'pendente').length
  const enviadasNoMes = registros.filter(r =>
    r.status === 'enviada' &&
    r.data_inicio != null &&
    r.data_inicio >= startOfMonth &&
    r.data_inicio <= endOfMonth,
  ).length
  const postosAtivos = new Set(
    registros
      .filter(r => r.status === 'pendente')
      .map(r => r.funcionarios?.postos?.id)
      .filter(Boolean),
  ).size

  const secretarias = Array.from(
    new Set(
      registros
        .map(r => r.funcionarios?.postos?.secretaria)
        .filter((s): s is string => Boolean(s)),
    ),
  ).sort()

  let filtered = registros

  if (searchParams.status) {
    filtered = filtered.filter(r => r.status === searchParams.status)
  }
  if (searchParams.secretaria) {
    filtered = filtered.filter(
      r => r.funcionarios?.postos?.secretaria === searchParams.secretaria,
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Insalubridade</h1>
        <p className="text-sm text-gray-400">Gestão de declarações de insalubridade</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <CounterCard label="Pendentes"        value={pendentes}     topColor="border-t-yellow-500" />
        <CounterCard label="Enviadas no Mês"  value={enviadasNoMes} topColor="border-t-green-500"  />
        <CounterCard label="Postos com Ativa" value={postosAtivos}  topColor="border-t-orange-500" />
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
            <option value="pendente">Pendente</option>
            <option value="enviada">Enviada</option>
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
          href="/insalubridade"
          className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-400 hover:bg-gray-50"
        >
          Limpar
        </a>
      </form>

      <InsalubridadeTable registros={filtered} />
    </div>
  )
}
