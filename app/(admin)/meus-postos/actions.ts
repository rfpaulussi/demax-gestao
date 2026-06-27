'use server'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'

export type FuncionarioPostoInfo = {
  id: string
  nome: string
  status: string
  motivo_afastamento: string | null
  data_fim_atestado: string | null
  coberturas: CoberturaInfo[]
}

export type CoberturaInfo = {
  id: string
  substituto_nome: string
  data_prevista_retorno: string | null
  venceHoje: boolean
  venceAmanha: boolean
}

export type PostoStatus = {
  id: string
  nome: string
  secretaria: string | null
  efetivo_previsto: number | null
  funcionarios: FuncionarioPostoInfo[]
  coberturas: CoberturaInfo[]
  descoberto: boolean
  coberturaVencendo: boolean
}

export async function buscarMeusPostos(): Promise<PostoStatus[]> {
  const auth = await getUser()
  if (!auth) return []

  const supabase = createClient()
  const hoje = new Date().toISOString().split('T')[0]
  const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  // 1. Busca postos do supervisor
  const { data: spPostos } = await supabase
    .from('config_supervisores_postos')
    .select('posto_id, postos!posto_id(id, nome, secretaria, efetivo_previsto)')
    .eq('supervisor_id', auth.user.id)
    .eq('ativo', true)

  if (!spPostos || spPostos.length === 0) return []

  type SpRow = { posto_id: string; postos: { id: string; nome: string; secretaria: string | null; efetivo_previsto: number | null } | null }
  const postos = (spPostos as unknown as SpRow[])
    .map(r => r.postos)
    .filter(Boolean)
    .filter(p => (p!.secretaria ?? '').toUpperCase() !== 'AFASTADOS') as { id: string; nome: string; secretaria: string | null; efetivo_previsto: number | null }[]

  const postoIds = postos.map(p => p.id)

  // 2. Funcionários nos postos
  const { data: funcs } = await supabase
    .from('funcionarios')
    .select('id, nome, status, motivo_afastamento, posto_id')
    .in('posto_id', postoIds)
    .in('status', ['ativo', 'atestado', 'ferias'])

  // 3. Atestados ativos para pegar data_fim
  const funcIds = (funcs ?? []).map(f => f.id)
  const { data: atestadosAtivos } = funcIds.length > 0
    ? await supabase
        .from('atestados')
        .select('funcionario_id, data_fim')
        .in('funcionario_id', funcIds)
        .gte('data_fim', hoje)
        .order('data_fim', { ascending: false })
    : { data: [] }

  const dataFimMap: Record<string, string> = {}
  for (const a of atestadosAtivos ?? []) {
    if (!dataFimMap[a.funcionario_id]) dataFimMap[a.funcionario_id] = a.data_fim
  }

  // 4. Coberturas ativas nos postos
  const { data: coberturas } = await supabase
    .from('coberturas_temporarias')
    .select(`
      id,
      funcionario_ausente_id,
      data_prevista_retorno,
      substitutos:funcionarios!substituto_id(nome)
    `)
    .in('funcionario_ausente_id', funcIds)
    .eq('status', 'ativa')

  type CobRow = {
    id: string
    funcionario_ausente_id: string
    data_prevista_retorno: string | null
    substitutos: { nome: string } | null
  }

  // Mapa: ausente_id → coberturas
  const coberturasPorAusente: Record<string, CoberturaInfo[]> = {}
  for (const c of (coberturas ?? []) as unknown as CobRow[]) {
    const aid = c.funcionario_ausente_id
    if (!coberturasPorAusente[aid]) coberturasPorAusente[aid] = []
    coberturasPorAusente[aid].push({
      id: c.id,
      substituto_nome: c.substitutos?.nome ?? '—',
      data_prevista_retorno: c.data_prevista_retorno,
      venceHoje: c.data_prevista_retorno === hoje,
      venceAmanha: c.data_prevista_retorno === amanha,
    })
  }

  // 5. Monta resultado por posto
  type FuncRow = { id: string; nome: string; status: string; motivo_afastamento: string | null; posto_id: string | null }
  const funcsPorPosto: Record<string, FuncRow[]> = {}
  for (const f of (funcs ?? []) as unknown as FuncRow[]) {
    const pid = f.posto_id ?? ''
    if (!funcsPorPosto[pid]) funcsPorPosto[pid] = []
    funcsPorPosto[pid].push(f)
  }

  return postos.map(posto => {
    const pFuncs = funcsPorPosto[posto.id] ?? []

    const funcionarios: FuncionarioPostoInfo[] = pFuncs.map(f => ({
      id: f.id,
      nome: f.nome,
      status: f.status,
      motivo_afastamento: f.motivo_afastamento,
      data_fim_atestado: dataFimMap[f.id] ?? null,
      coberturas: coberturasPorAusente[f.id] ?? [],
    }))

    const ausentes = funcionarios.filter(f => f.status === 'atestado' || f.status === 'ferias')

    // Cobertura vencendo = qualquer ausente tem cobertura vencendo hoje ou amanhã
    const coberturaVencendo = ausentes.some(f =>
      (coberturasPorAusente[f.id] ?? []).some(c => c.venceHoje || c.venceAmanha)
    )

    // Descoberto = tem ausente sem nenhuma cobertura ativa
    const descoberto = ausentes.some(f => !coberturasPorAusente[f.id]?.length)

    // Coleta todas coberturas do posto (para display)
    const todasCoberturas: CoberturaInfo[] = ausentes.flatMap(f => coberturasPorAusente[f.id] ?? [])

    return {
      id: posto.id,
      nome: posto.nome,
      secretaria: posto.secretaria,
      efetivo_previsto: posto.efetivo_previsto,
      funcionarios,
      coberturas: todasCoberturas,
      descoberto,
      coberturaVencendo,
    }
  })
}
