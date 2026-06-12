import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

type AtestadoRaw = {
  id: string
  funcionario_id: string
  posto_id: string | null
  data_inicio: string
  data_fim: string
  cid: string | null
  cid_codigo: string | null
  created_at: string
  funcionarios: { id: string; nome: string } | null
  postos: { nome: string; secretaria: string | null } | null
}

function calcDias(inicio: string, fim: string): number {
  const [ay, am, ad] = inicio.split('-').map(Number)
  const [by, bm, bd] = fim.split('-').map(Number)
  const a = new Date(ay, am - 1, ad)
  const b = new Date(by, bm - 1, bd)
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const inputClass =
  'flex h-9 rounded-lg border border-gray-200 bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

export default async function AtestadosPage({
  searchParams,
}: {
  searchParams: { busca?: string; secretaria?: string }
}) {
  const auth = await getUser()
  if (!auth) redirect('/login')
  if (auth.perfil.role !== 'admin' && auth.perfil.role !== 'coordenador') {
    redirect(auth.perfil.role === 'supervisor' ? '/supervisor/meu-posto' : '/dashboard')
  }

  const supabase = createClient()

  const [{ data: rawAtestados }, { data: rawCids }] = await Promise.all([
    supabase
      .from('atestados')
      .select(`
        id, funcionario_id, posto_id, data_inicio, data_fim, cid, cid_codigo, created_at,
        funcionarios!funcionario_id ( id, nome ),
        postos!posto_id ( nome, secretaria )
      `)
      .order('data_inicio', { ascending: false })
      .range(0, 1499),
    supabase.from('cid_referencia').select('codigo, descricao'),
  ])

  const cidMap = new Map(
    (rawCids ?? []).map(c => [c.codigo, c.descricao] as [string, string]),
  )

  const all = (rawAtestados ?? []) as unknown as AtestadoRaw[]

  // Calcular acumulado 30 dias por funcionário (sobre todos os registros, antes do filtro)
  const hoje = new Date()
  const limite = new Date(hoje)
  limite.setDate(hoje.getDate() - 30)
  const limiteStr = toDateStr(limite)

  const acumulado = new Map<string, number>()
  for (const a of all) {
    if (!a.data_fim || a.data_fim < limiteStr) continue
    const dias = calcDias(a.data_inicio, a.data_fim)
    acumulado.set(a.funcionario_id, (acumulado.get(a.funcionario_id) ?? 0) + dias)
  }

  // Filtros
  const buscaLower    = searchParams.busca?.toLowerCase() ?? ''
  const secFilter     = searchParams.secretaria ?? ''

  let filtered = all
  if (buscaLower) filtered = filtered.filter(a =>
    (a.funcionarios?.nome ?? '').toLowerCase().includes(buscaLower),
  )
  if (secFilter) filtered = filtered.filter(a =>
    (a.postos?.secretaria ?? '') === secFilter,
  )

  // Secretarias disponíveis para o select
  const secretarias = Array.from(
    new Set(all.map(a => a.postos?.secretaria).filter((s): s is string => Boolean(s))),
  ).sort()

  const totalAlerta = Array.from(acumulado.values()).filter(v => v > 15).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Atestados</h1>
          <p className="text-sm text-gray-400">Controle de afastamentos por atestado médico</p>
        </div>
        {totalAlerta > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2">
            <span className="text-sm font-semibold text-red-700">
              ⚠️ {totalAlerta} funcionário{totalAlerta > 1 ? 's' : ''} com acumulado &gt; 15 dias
            </span>
          </div>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-t-4 border-gray-100 border-t-blue-500 bg-white p-5 shadow-sm">
          <p className="text-3xl font-black tracking-tight text-gray-900">{all.length}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Total</p>
        </div>
        <div className="rounded-xl border border-t-4 border-gray-100 border-t-amber-500 bg-white p-5 shadow-sm">
          <p className="text-3xl font-black tracking-tight text-gray-900">
            {all.filter(a => a.data_fim >= toDateStr(limite)).length}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Últimos 30 dias</p>
        </div>
        <div className="rounded-xl border border-t-4 border-gray-100 border-t-red-500 bg-white p-5 shadow-sm">
          <p className="text-3xl font-black tracking-tight text-gray-900">{totalAlerta}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Avaliar INSS</p>
        </div>
      </div>

      {/* Filtros */}
      <form method="get" className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          name="busca"
          defaultValue={searchParams.busca}
          placeholder="Buscar funcionário..."
          className={cn(inputClass, 'w-56')}
        />
        <select
          name="secretaria"
          defaultValue={searchParams.secretaria}
          className={cn(inputClass, 'w-44')}
        >
          <option value="">Todas as secretarias</option>
          {secretarias.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          type="submit"
          className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          Filtrar
        </button>
        <a
          href="/atestados"
          className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
        >
          Limpar
        </a>
      </form>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">Nenhum atestado encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-slate-50">
                <tr>
                  {['Funcionário', 'Posto', 'Secretaria', 'Início', 'Fim', 'Dias', 'CID', 'Acum. 30d'].map(col => (
                    <th
                      key={col}
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(a => {
                  const dias  = calcDias(a.data_inicio, a.data_fim)
                  const acum  = acumulado.get(a.funcionario_id) ?? 0
                  const alerta = acum > 15
                  const cidDesc = a.cid_codigo
                    ? cidMap.get(a.cid_codigo) ?? a.cid_codigo
                    : (a.cid ?? '—')

                  return (
                    <tr
                      key={a.id}
                      className={cn(
                        'transition-colors',
                        alerta ? 'bg-red-50 hover:bg-red-100' : 'bg-white hover:bg-gray-50',
                      )}
                    >
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        {a.funcionarios?.nome ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{a.postos?.nome ?? '—'}</td>
                      <td className="px-5 py-3.5 text-gray-500">{a.postos?.secretaria ?? '—'}</td>
                      <td className="px-5 py-3.5 text-gray-500 tabular-nums">
                        {a.data_inicio.split('-').reverse().join('/')}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 tabular-nums">
                        {a.data_fim.split('-').reverse().join('/')}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums text-gray-700">{dias}</td>
                      <td className="px-5 py-3.5 text-gray-500">
                        {a.cid_codigo ? (
                          <span title={cidMap.get(a.cid_codigo)}>
                            <span className="font-mono font-semibold text-blue-700">{a.cid_codigo}</span>
                            {cidMap.get(a.cid_codigo) && (
                              <span className="ml-1 text-gray-400">— {cidMap.get(a.cid_codigo)}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400">{cidDesc}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={cn('tabular-nums font-semibold', alerta ? 'text-red-700' : 'text-gray-700')}>
                            {acum}d
                          </span>
                          {alerta && (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-red-700 ring-1 ring-inset ring-red-200">
                              ⚠️ Avaliar INSS
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
