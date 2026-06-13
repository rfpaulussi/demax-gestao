import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { AtestadosClient, type AtestadoRow } from '@/components/atestados/atestados-client'

type AtestadoRaw = {
  id: string
  funcionario_id: string
  posto_id: string | null
  data_inicio: string
  data_fim: string
  motivo: string | null
  cid_codigo: string | null
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
  searchParams: { busca?: string; secretaria?: string; posto?: string; data_de?: string; data_ate?: string }
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
        id, funcionario_id, posto_id, data_inicio, data_fim, motivo, cid_codigo,
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
  const cids = (rawCids ?? []).map(c => ({ codigo: c.codigo, descricao: c.descricao }))

  const all = (rawAtestados ?? []) as unknown as AtestadoRaw[]

  // Acumulado 30 dias por funcionário (calculado sobre todos os registros, antes de filtrar)
  const hoje = new Date()
  const limite = new Date(hoje)
  limite.setDate(hoje.getDate() - 30)
  const limiteStr = toDateStr(limite)

  const acumuladoMap = new Map<string, number>()
  for (const a of all) {
    if (!a.data_fim || a.data_fim < limiteStr) continue
    const dias = calcDias(a.data_inicio, a.data_fim)
    acumuladoMap.set(a.funcionario_id, (acumuladoMap.get(a.funcionario_id) ?? 0) + dias)
  }

  // Opções de filtro derivadas de todos os registros
  const secretarias = Array.from(
    new Set(all.map(a => a.postos?.secretaria).filter((s): s is string => Boolean(s))),
  ).sort()
  const postos = Array.from(
    new Set(all.map(a => a.postos?.nome).filter((s): s is string => Boolean(s))),
  ).sort()

  // Aplicar filtros
  const buscaLower = searchParams.busca?.toLowerCase() ?? ''
  const secFilter  = searchParams.secretaria ?? ''
  const postoFilter = searchParams.posto ?? ''
  const dataDe     = searchParams.data_de ?? ''
  const dataAte    = searchParams.data_ate ?? ''

  let filtered = all
  if (buscaLower)   filtered = filtered.filter(a => (a.funcionarios?.nome ?? '').toLowerCase().includes(buscaLower))
  if (secFilter)    filtered = filtered.filter(a => (a.postos?.secretaria ?? '') === secFilter)
  if (postoFilter)  filtered = filtered.filter(a => (a.postos?.nome ?? '') === postoFilter)
  if (dataDe)       filtered = filtered.filter(a => a.data_inicio >= dataDe)
  if (dataAte)      filtered = filtered.filter(a => a.data_inicio <= dataAte)

  // Mapear para AtestadoRow com campos computados
  const rows: AtestadoRow[] = filtered.map(a => {
    const dias     = calcDias(a.data_inicio, a.data_fim)
    const acumulado = acumuladoMap.get(a.funcionario_id) ?? 0
    const cidDesc  = a.cid_codigo ? (cidMap.get(a.cid_codigo) ?? a.cid_codigo) : ''
    return {
      id: a.id,
      funcionario_id: a.funcionario_id,
      posto_id: a.posto_id,
      data_inicio: a.data_inicio,
      data_fim: a.data_fim,
      motivo: a.motivo,
      cid_codigo: a.cid_codigo,
      funcionario_nome: a.funcionarios?.nome ?? '—',
      posto_nome: a.postos?.nome ?? '—',
      secretaria: a.postos?.secretaria ?? '—',
      dias,
      acumulado,
      alerta: acumulado > 15,
      cid_desc: cidDesc,
    }
  })

  const totalAlerta = Array.from(acumuladoMap.values()).filter(v => v > 15).length

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

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-t-4 border-gray-100 border-t-blue-500 bg-white p-5 shadow-sm">
          <p className="text-3xl font-black tracking-tight text-gray-900">{all.length}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Total</p>
        </div>
        <div className="rounded-xl border border-t-4 border-gray-100 border-t-amber-500 bg-white p-5 shadow-sm">
          <p className="text-3xl font-black tracking-tight text-gray-900">
            {all.filter(a => a.data_fim >= limiteStr).length}
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
          className={cn(inputClass, 'w-52')}
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
        <select
          name="posto"
          defaultValue={searchParams.posto}
          className={cn(inputClass, 'w-44')}
        >
          <option value="">Todos os postos</option>
          {postos.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="date"
            name="data_de"
            defaultValue={searchParams.data_de}
            className={cn(inputClass, 'w-36')}
            title="Início a partir de"
          />
          <span className="text-sm text-gray-400">até</span>
          <input
            type="date"
            name="data_ate"
            defaultValue={searchParams.data_ate}
            className={cn(inputClass, 'w-36')}
            title="Início até"
          />
        </div>
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
        <AtestadosClient atestados={rows} cids={cids} />
      </div>
    </div>
  )
}
