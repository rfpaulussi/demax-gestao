'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { getUser } from '@/lib/auth/get-user'
import { FUNCOES_FORA_DO_EFETIVO } from '@/lib/constants'

type ActionResult = { success: true } | { success: false; error: string }

export async function solicitarAdmissao(fd: FormData): Promise<ActionResult> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }

  const nome               = (fd.get('nome') as string)?.trim().toUpperCase()
  const registro           = (fd.get('registro') as string)?.trim()
  const funcao_id          = fd.get('funcao_id') as string
  const posto_id           = fd.get('posto_id') as string
  const data_admissao      = fd.get('data_admissao') as string
  const periodo_experiencia = fd.get('periodo_experiencia') as string

  if (!nome)          return { success: false, error: 'Nome obrigatório' }
  if (!registro)      return { success: false, error: 'Registro (PIS/NIT) obrigatório' }
  if (!funcao_id)     return { success: false, error: 'Função obrigatória' }
  if (!posto_id)      return { success: false, error: 'Posto obrigatório' }
  if (!data_admissao) return { success: false, error: 'Data de admissão obrigatória' }
  if (!(['nenhum', '30+30', '45+45'] as const).includes(periodo_experiencia as 'nenhum' | '30+30' | '45+45')) {
    return { success: false, error: 'Período de experiência inválido' }
  }

  const [{ data: funcao }, { data: posto }] = await Promise.all([
    supabase.from('funcoes').select('nome').eq('id', funcao_id).single(),
    supabase.from('postos').select('nome, secretaria').eq('id', posto_id).single(),
  ])

  const postoTyped = posto as unknown as { nome: string; secretaria: string | null } | null

  const { error } = await supabase.from('solicitacoes').insert({
    tipo:           'admissao' as unknown as 'desligamento',
    status:         'pendente',
    supervisor_id:  auth.user.id,
    funcionario_id: null as unknown as string,
    dados_antes:    null,
    dados_depois: {
      nome,
      registro,
      funcao_id,
      funcao_nome:          funcao?.nome ?? null,
      posto_id,
      posto_nome:           postoTyped?.nome ?? null,
      secretaria:           postoTyped?.secretaria ?? null,
      data_admissao,
      periodo_experiencia,
    },
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/aprovacoes')
  return { success: true }
}



const CONTRATO_ID = 'c73a81ae-0104-4c05-b7d6-e6266f6be1b2'

export type PostoFuncionario = {
  id: string
  nome: string
  funcao_nome: string
  status: string
  motivo_afastamento: string | null
  pcd: boolean
  pcd_tipo: string | null
  pcd_tipo_outro: string | null
}

export type PostoRow = {
  id: string
  nome: string
  secretaria: string
  efetivo_previsto: number
  cota_insalubridade: number
  ativo: boolean
  efetivo_atual: number
  insalubridade_atual: number
  em_ferias: number
  supervisor_nome: string | null
  cobertura_como_origem: boolean
  cobertura_como_destino: boolean
  funcionarios: PostoFuncionario[]
}

type ConfigRow = {
  posto_id: string
  supervisor_id: string
  perfis: { id: string; nome: string | null } | null
}

// Funções que contam como insalubre por secretaria (padrão é B, mas A também conta —
// exceto SMS, que só usa A, e SMMT, que tem regra própria por posto abaixo)
const INSALUBRIDADE_POR_SECRETARIA: Record<string, string[]> = {
  SME:   ['AGENTE DE HIGIENIZAÇÃO B', 'AGENTE DE HIGIENIZAÇÃO A'],
  SMS:   ['AGENTE DE HIGIENIZAÇÃO A'],
  SMGCP: ['AGENTE DE HIGIENIZAÇÃO B', 'AGENTE DE HIGIENIZAÇÃO A'],
  SMEL:  ['AGENTE DE HIGIENIZAÇÃO B', 'AGENTE DE HIGIENIZAÇÃO A'],
  SEMAS: ['AGENTE DE HIGIENIZAÇÃO B', 'AGENTE DE HIGIENIZAÇÃO A'],
  SMAPA: ['AGENTE DE HIGIENIZAÇÃO B', 'AGENTE DE HIGIENIZAÇÃO A'],
  SMSEG: ['AGENTE DE HIGIENIZAÇÃO B', 'AGENTE DE HIGIENIZAÇÃO A'],
  SMC:   ['AGENTE DE HIGIENIZAÇÃO B', 'AGENTE DE HIGIENIZAÇÃO A'],
  SMDET: ['AGENTE DE HIGIENIZAÇÃO B', 'AGENTE DE HIGIENIZAÇÃO A'],
  SMASA: ['AGENTE DE HIGIENIZAÇÃO B', 'AGENTE DE HIGIENIZAÇÃO A'],
  SMGOV: ['AGENTE DE HIGIENIZAÇÃO B', 'AGENTE DE HIGIENIZAÇÃO A'],
  SMSUZ: ['AGENTE DE HIGIENIZAÇÃO B', 'AGENTE DE HIGIENIZAÇÃO A'],
  SEDE:  ['AGENTE DE HIGIENIZAÇÃO B', 'AGENTE DE HIGIENIZAÇÃO A'],
  // SMMT: demais postos (fora dos Terminais) aceitam A, B ou C — padrão é B, mas trocas momentâneas ocorrem
  SMMT:  ['AGENTE DE HIGIENIZAÇÃO A', 'AGENTE DE HIGIENIZAÇÃO B', 'AGENTE DE HIGIENIZAÇÃO C'],
}

// Terminais de ônibus da SMMT têm regra própria: só Agente C e Ajudante de Limpeza contam
const POSTOS_TERMINAL_SMMT = new Set(['TERMINAL CENTRAL', 'TERMINAL ESTUDANTES'])
const INSALUBRIDADE_TERMINAL_SMMT = ['AGENTE DE HIGIENIZAÇÃO C', 'AJUDANTE DE LIMPEZA']

function funcoesAceitasInsalubridade(secretaria: string, postoNome: string): string[] {
  if (secretaria === 'SMMT' && POSTOS_TERMINAL_SMMT.has(postoNome)) {
    return INSALUBRIDADE_TERMINAL_SMMT
  }
  return INSALUBRIDADE_POR_SECRETARIA[secretaria] ?? []
}

// Tipo local até eh_encarregado_volante ser adicionado aos tipos gerados do Supabase
interface FuncionarioRow {
  id: string
  nome: string
  posto_id: string | null
  status: string
  motivo_afastamento: string | null
  funcao_id: string | null
  eh_encarregado_volante: boolean | null
  pcd: boolean | null
  pcd_tipo: string | null
  pcd_tipo_outro: string | null
  funcoes: { nome: string } | null
}

export async function getPostosData(): Promise<PostoRow[]> {
  const supabase = createClient()

  // Pre-fetch todas as funções com nome para filtrar efetivo e calcular insalubridade
  const { data: funcoesRaw } = await supabase.from('funcoes').select('id, nome')
  const excludedFuncaoIds = new Set(
    (funcoesRaw ?? []).filter(f => FUNCOES_FORA_DO_EFETIVO.includes(f.nome as never)).map(f => f.id)
  )
  // mapa funcao_id → nome normalizado (maiúsculas)
  const funcaoNomeMap = new Map<string, string>(
    (funcoesRaw ?? []).map(f => [f.id, f.nome.trim().toUpperCase()])
  )

  const hoje = new Date()

  const [{ data: postos }, funcionariosRaw, { data: config }, { data: coberturas }] = await Promise.all([
    supabase
      .from('postos')
      .select('id, nome, secretaria, efetivo_previsto, cota_insalubridade, ativo')
      .eq('contrato_id', CONTRATO_ID)
      .eq('ativo', true)
      .order('secretaria', { ascending: true })
      .order('nome', { ascending: true }),
    // paginado para superar max_rows do PostgREST; inclui funcao_id e eh_encarregado_volante para filtragem
    fetchAllRows<FuncionarioRow>((from, to) =>
      supabase
        .from('funcionarios')
        .select('id, nome, posto_id, status, motivo_afastamento, funcao_id, eh_encarregado_volante, pcd, pcd_tipo, pcd_tipo_outro, funcoes!funcao_id(nome)')
        .in('status', ['ativo', 'ferias', 'atestado', 'afastado', 'faltante'])
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: FuncionarioRow[] | null; error: { message: string } | null }>,
    ),
    supabase
      .from('config_supervisores_postos')
      .select('posto_id, supervisor_id, perfis!supervisor_id(id, nome)')
      .eq('ativo', true),
    supabase
      .from('coberturas_temporarias')
      .select('posto_origem_id, posto_destino_id')
      .eq('status', 'ativa')
      .lte('data_inicio', hoje.toISOString().split('T')[0])
      .or(`data_prev_retorno.is.null,data_prev_retorno.gte.${hoje.toISOString().split('T')[0]}`),
  ])

  // Mapa posto_id → secretaria/nome para diferenciar postos AFASTADOS e aplicar regras por posto (ex: Terminais SMMT)
  const postoSecretariaMap = new Map<string, string>()
  const postoNomeMap = new Map<string, string>()
  for (const p of postos ?? []) {
    postoSecretariaMap.set(p.id, (p.secretaria ?? '').toUpperCase())
    postoNomeMap.set(p.id, (p.nome ?? '').toUpperCase())
  }

  const efetivoMap = new Map<string, number>()
  const insalubMap = new Map<string, number>()
  const feriasMap  = new Map<string, number>()
  const funcionariosPorPosto = new Map<string, PostoFuncionario[]>()
  for (const f of funcionariosRaw) {
    if (!f.posto_id) continue

    const lista = funcionariosPorPosto.get(f.posto_id) ?? []
    lista.push({
      id: f.id,
      nome: f.nome,
      funcao_nome: f.funcoes?.nome ?? '—',
      status: f.status,
      motivo_afastamento: f.motivo_afastamento,
      pcd: f.pcd ?? false,
      pcd_tipo: f.pcd_tipo,
      pcd_tipo_outro: f.pcd_tipo_outro,
    })
    funcionariosPorPosto.set(f.posto_id, lista)

    const secretaria = postoSecretariaMap.get(f.posto_id) ?? ''
    const isPostoAfastados = secretaria === 'AFASTADOS'

    if (isPostoAfastados) {
      // Postos AFASTADOS: conta todos os afastados sem restrição de função ou volante
      if (f.status !== 'afastado' && f.status !== 'atestado') continue
    } else {
      // Postos operacionais: só ativo/ferias, excluindo ausentes e volantes
      if (f.status === 'afastado' || f.status === 'atestado' || f.status === 'faltante') continue
      if (f.funcao_id && excludedFuncaoIds.has(f.funcao_id)) continue
      if (f.eh_encarregado_volante === true) continue
      // Férias: registra badge mas NÃO entra no efetivo_atual (posto fica com déficit)
      if (f.status === 'ferias') {
        feriasMap.set(f.posto_id, (feriasMap.get(f.posto_id) ?? 0) + 1)
        continue
      }
    }
    efetivoMap.set(f.posto_id, (efetivoMap.get(f.posto_id) ?? 0) + 1)

    // Conta como insalubre se a função do funcionário bate com a regra da secretaria/posto
    const funcoesAceitas = funcoesAceitasInsalubridade(secretaria, postoNomeMap.get(f.posto_id) ?? '')
    if (funcoesAceitas.length && f.funcao_id) {
      const funcaoNome = funcaoNomeMap.get(f.funcao_id) ?? ''
      if (funcoesAceitas.includes(funcaoNome)) {
        insalubMap.set(f.posto_id, (insalubMap.get(f.posto_id) ?? 0) + 1)
      }
    }
  }

  const supervisorMap = new Map<string, string>()
  for (const row of (config ?? []) as unknown as ConfigRow[]) {
    if (!supervisorMap.has(row.posto_id) && row.perfis?.nome) {
      supervisorMap.set(row.posto_id, row.perfis.nome)
    }
  }

  const coberturaOrigemIds  = new Set<string>()
  const coberturaDestinoIds = new Set<string>()
  for (const c of coberturas ?? []) {
    if (c.posto_origem_id)  coberturaOrigemIds.add(c.posto_origem_id)
    if (c.posto_destino_id) coberturaDestinoIds.add(c.posto_destino_id)
  }

  return (postos ?? []).map(p => ({
    id: p.id,
    nome: p.nome,
    secretaria: p.secretaria ?? '',
    efetivo_previsto: p.efetivo_previsto ?? 0,
    cota_insalubridade: p.cota_insalubridade ?? 0,
    ativo: p.ativo ?? true,
    efetivo_atual: efetivoMap.get(p.id) ?? 0,
    insalubridade_atual: insalubMap.get(p.id) ?? 0,
    em_ferias: feriasMap.get(p.id) ?? 0,
    supervisor_nome: supervisorMap.get(p.id) ?? null,
    cobertura_como_origem:  coberturaOrigemIds.has(p.id),
    cobertura_como_destino: coberturaDestinoIds.has(p.id),
    funcionarios: funcionariosPorPosto.get(p.id) ?? [],
  }))
}

export async function criarPosto(data: {
  nome: string
  secretaria: string
  efetivo_previsto: number
  cota_insalubridade: number
}): Promise<{ error?: string }> {
  const supabase = createClient()
  const { data: contratos } = await supabase
    .from('contratos')
    .select('id')
    .eq('ativo', true)
    .limit(1)
    .single()
  if (!contratos) return { error: 'Contrato ativo não encontrado' }

  const { error } = await supabase.from('postos').insert({
    contrato_id: contratos.id,
    nome: data.nome.trim().toUpperCase(),
    secretaria: data.secretaria.trim().toUpperCase(),
    efetivo_previsto: data.efetivo_previsto,
    cota_insalubridade: data.cota_insalubridade,
    ativo: true,
  })
  if (error) return { error: error.message }
  revalidatePath('/postos')
  return {}
}

export async function editarPosto(id: string, data: {
  nome: string
  secretaria: string
  efetivo_previsto: number
  cota_insalubridade: number
}): Promise<{ error?: string }> {
  const supabase = createClient()
  const { error } = await supabase.from('postos').update({
    nome: data.nome.trim().toUpperCase(),
    secretaria: data.secretaria.trim().toUpperCase(),
    efetivo_previsto: data.efetivo_previsto,
    cota_insalubridade: data.cota_insalubridade,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/postos')
  return {}
}

export async function desativarPosto(id: string): Promise<{ error?: string }> {
  const supabase = createClient()
  const { error } = await supabase.from('postos').update({
    ativo: false,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/postos')
  return {}
}
