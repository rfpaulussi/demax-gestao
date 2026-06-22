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
  origem_ocupacional: string | null
  funcionarios: { id: string; nome: string } | null
  postos: {
    nome: string
    secretaria: string | null
    config_supervisores_postos: Array<{
      ativo: boolean
      perfis: { nome: string } | null
    }> | null
  } | null
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
  if (auth.perfil.role === 'viewer') redirect('/dashboard')

  const supabase = createClient()

  // Supervisor vê só os atestados dos postos que gerencia
  let postoIds: string[] | null = null
  if (auth.perfil.role === 'supervisor') {
    const { data: postos } = await supabase
      .from('config_supervisores_postos')
      .select('posto_id')
      .eq('supervisor_id', auth.user.id)
    postoIds = (postos ?? []).map(p => p.posto_id)
  }

  const [{ data: rawAtestados }, { data: rawCids }, { data: rawCoberturas }] = await Promise.all([
    (() => {
      let q = supabase
        .from('atestados')
        .select(`
          id, funcionario_id, posto_id, data_inicio, data_fim, motivo, cid_codigo, origem_ocupacional,
          funcionarios!funcionario_id ( id, nome ),
          postos!posto_id (
            nome, secretaria,
            config_supervisores_postos!posto_id (
              ativo,
              perfis!supervisor_id ( nome )
            )
          )
        `)
        .order('data_inicio', { ascending: false })
        .range(0, 1499)
      if (postoIds) q = q.in('posto_id', postoIds.length > 0 ? postoIds : ['__none__'])
      return q
    })(),
    supabase.from('cid_referencia').select('codigo, descricao, nexo_ocupacional_limpeza'),
    supabase
      .from('coberturas_temporarias')
      .select('funcionario_ausente_id, data_inicio, data_retorno_real, data_prev_retorno')
      .not('funcionario_ausente_id', 'is', null)
      .range(0, 1499),
  ])

  type CidRef = { codigo: string; descricao: string; nexo_ocupacional_limpeza: boolean }
  const cidsRaw = (rawCids ?? []) as unknown as CidRef[]

  const cidMap = new Map(cidsRaw.map(c => [c.codigo, c.descricao] as [string, string]))
  const nexoMap = new Map(cidsRaw.map(c => [c.codigo, c.nexo_ocupacional_limpeza ?? false] as [string, boolean]))
  const cids = cidsRaw.map(c => ({ codigo: c.codigo, descricao: c.descricao }))

  type CoberturaLookup = { funcionario_ausente_id: string; data_inicio: string; data_fim: string }
  type CoberturaRaw = { funcionario_ausente_id: string; data_inicio: string; data_retorno_real: string | null; data_prev_retorno: string | null }
  const coberturas: CoberturaLookup[] = ((rawCoberturas ?? []) as unknown as CoberturaRaw[]).map(c => ({
    funcionario_ausente_id: c.funcionario_ausente_id,
    data_inicio: c.data_inicio,
    data_fim: c.data_retorno_real ?? c.data_prev_retorno ?? c.data_inicio,
  }))

  function temCobertura(funcionario_id: string, atestado_inicio: string, atestado_fim: string): boolean {
    return coberturas.some(
      c =>
        c.funcionario_ausente_id === funcionario_id &&
        c.data_inicio <= atestado_fim &&
        c.data_fim >= atestado_inicio,
    )
  }

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
    const supervisorNome =
      a.postos?.config_supervisores_postos
        ?.find(c => c.ativo)
        ?.perfis?.nome ?? null
    return {
      id: a.id,
      funcionario_id: a.funcionario_id,
      posto_id: a.posto_id,
      data_inicio: a.data_inicio,
      data_fim: a.data_fim,
      motivo: a.motivo,
      cid_codigo: a.cid_codigo,
      origem_ocupacional: a.origem_ocupacional,
      funcionario_nome: a.funcionarios?.nome ?? '—',
      posto_nome: a.postos?.nome ?? '—',
      secretaria: a.postos?.secretaria ?? '—',
      supervisor_nome: supervisorNome,
      dias,
      acumulado,
      alerta: acumulado > 15,
      cid_desc: cidDesc,
      nexo_ocupacional: a.cid_codigo ? (nexoMap.get(a.cid_codigo) ?? false) : false,
      tem_cobertura: temCobertura(a.funcionario_id, a.data_inicio, a.data_fim),
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-t-4 border-gray-100 border-t-blue-500 bg-white p-5 shadow-sm">
          <p className="text-2xl font-black tracking-tight text-gray-900">{all.length}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Total</p>
        </div>
        <div className="rounded-xl border border-t-4 border-gray-100 border-t-amber-500 bg-white p-5 shadow-sm">
          <p className="text-2xl font-black tracking-tight text-gray-900">
            {all.filter(a => a.data_fim >= limiteStr).length}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Últimos 30 dias</p>
        </div>
        <div className="rounded-xl border border-t-4 border-gray-100 border-t-red-500 bg-white p-5 shadow-sm">
          <p className="text-2xl font-black tracking-tight text-gray-900">{totalAlerta}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Avaliar INSS</p>
        </div>
      </div>

      {/* Filtros */}
      <form method="get" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
        <input
          type="text"
          name="busca"
          defaultValue={searchParams.busca}
          placeholder="Buscar funcionário..."
          className={cn(inputClass, 'col-span-2 w-full sm:w-52')}
        />
        <select
          name="secretaria"
          defaultValue={searchParams.secretaria}
          className={cn(inputClass, 'w-full sm:w-44')}
        >
          <option value="">Todas as secretarias</option>
          {secretarias.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          name="posto"
          defaultValue={searchParams.posto}
          className={cn(inputClass, 'w-full sm:w-44')}
        >
          <option value="">Todos os postos</option>
          {postos.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
          <input
            type="date"
            name="data_de"
            defaultValue={searchParams.data_de}
            className={cn(inputClass, 'w-full sm:w-36')}
            title="Início a partir de"
          />
          <span className="shrink-0 text-sm text-gray-400">até</span>
          <input
            type="date"
            name="data_ate"
            defaultValue={searchParams.data_ate}
            className={cn(inputClass, 'w-full sm:w-36')}
            title="Início até"
          />
        </div>
        <button
          type="submit"
          className="flex h-9 w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700 sm:w-auto"
        >
          Filtrar
        </button>
        <a
          href="/atestados"
          className="flex h-9 w-full items-center justify-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 sm:w-auto"
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
