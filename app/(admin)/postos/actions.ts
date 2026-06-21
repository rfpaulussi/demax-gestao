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

  const nome               = (fd.get('nome') as string)?.trim()
  const funcao_id          = fd.get('funcao_id') as string
  const posto_id           = fd.get('posto_id') as string
  const data_admissao      = fd.get('data_admissao') as string
  const periodo_experiencia = fd.get('periodo_experiencia') as string

  if (!nome)          return { success: false, error: 'Nome obrigatório' }
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

export type PostoRow = {
  id: string
  nome: string
  secretaria: string
  efetivo_previsto: number
  cota_insalubridade: number
  ativo: boolean
  efetivo_atual: number
  supervisor_nome: string | null
}

type ConfigRow = {
  posto_id: string
  supervisor_id: string
  perfis: { id: string; nome: string | null } | null
}

// Tipo local até eh_encarregado_volante ser adicionado aos tipos gerados do Supabase
interface FuncionarioRow {
  id: string
  posto_id: string | null
  status: string
  funcao_id: string | null
  eh_encarregado_volante: boolean | null
}

export async function getPostosData(): Promise<PostoRow[]> {
  const supabase = createClient()

  // Pre-fetch IDs dos cargos que não contam no efetivo contratual
  const { data: funcoesExcluidasRaw } = await supabase
    .from('funcoes')
    .select('id')
    .in('nome', [...FUNCOES_FORA_DO_EFETIVO])
  const excludedFuncaoIds = new Set((funcoesExcluidasRaw ?? []).map(f => f.id))

  const [{ data: postos }, funcionariosRaw, { data: config }] = await Promise.all([
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
        .select('id, posto_id, status, funcao_id, eh_encarregado_volante')
        .in('status', ['ativo', 'ferias', 'afastado'])
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: FuncionarioRow[] | null; error: { message: string } | null }>,
    ),
    supabase
      .from('config_supervisores_postos')
      .select('posto_id, supervisor_id, perfis!supervisor_id(id, nome)')
      .eq('ativo', true),
  ])

  // Mapa posto_id → secretaria para diferenciar postos AFASTADOS dos operacionais
  const postoSecretariaMap = new Map<string, string>()
  for (const p of postos ?? []) {
    postoSecretariaMap.set(p.id, (p.secretaria ?? '').toUpperCase())
  }

  const efetivoMap = new Map<string, number>()
  for (const f of funcionariosRaw) {
    if (!f.posto_id) continue
    const isPostoAfastados = postoSecretariaMap.get(f.posto_id) === 'AFASTADOS'
    if (isPostoAfastados) {
      // Postos AFASTADOS: conta todos os afastados sem restrição de função ou volante
      if (f.status !== 'afastado') continue
    } else {
      // Postos operacionais: só ativo/ferias, excluindo funções fora do efetivo e volantes
      if (f.status === 'afastado') continue
      if (f.funcao_id && excludedFuncaoIds.has(f.funcao_id)) continue
      if (f.eh_encarregado_volante === true) continue
    }
    efetivoMap.set(f.posto_id, (efetivoMap.get(f.posto_id) ?? 0) + 1)
  }

  const supervisorMap = new Map<string, string>()
  for (const row of (config ?? []) as unknown as ConfigRow[]) {
    if (!supervisorMap.has(row.posto_id) && row.perfis?.nome) {
      supervisorMap.set(row.posto_id, row.perfis.nome)
    }
  }

  return (postos ?? []).map(p => ({
    id: p.id,
    nome: p.nome,
    secretaria: p.secretaria ?? '',
    efetivo_previsto: p.efetivo_previsto ?? 0,
    cota_insalubridade: p.cota_insalubridade ?? 0,
    ativo: p.ativo ?? true,
    efetivo_atual: efetivoMap.get(p.id) ?? 0,
    supervisor_nome: supervisorMap.get(p.id) ?? null,
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
