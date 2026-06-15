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

  const nome          = (fd.get('nome') as string)?.trim()
  const funcao_id     = fd.get('funcao_id') as string
  const posto_id      = fd.get('posto_id') as string
  const data_admissao = fd.get('data_admissao') as string

  if (!nome)          return { success: false, error: 'Nome obrigatório' }
  if (!funcao_id)     return { success: false, error: 'Função obrigatória' }
  if (!posto_id)      return { success: false, error: 'Posto obrigatório' }
  if (!data_admissao) return { success: false, error: 'Data de admissão obrigatória' }

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
      funcao_nome:   funcao?.nome ?? null,
      posto_id,
      posto_nome:    postoTyped?.nome ?? null,
      secretaria:    postoTyped?.secretaria ?? null,
      data_admissao,
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
    // paginado para superar max_rows do PostgREST; inclui funcao_id para filtragem
    fetchAllRows((from, to) =>
      supabase
        .from('funcionarios')
        .select('id, posto_id, status, funcao_id')
        .in('status', ['ativo', 'afastado', 'ferias'])
        .order('id', { ascending: true })
        .range(from, to),
    ),
    supabase
      .from('config_supervisores_postos')
      .select('posto_id, supervisor_id, perfis!supervisor_id(id, nome)')
      .eq('ativo', true),
  ])

  // Excluir cargos fora do efetivo contratual
  const funcionarios = funcionariosRaw.filter(
    f => !f.funcao_id || !excludedFuncaoIds.has(f.funcao_id),
  )

  const efetivoMap = new Map<string, number>()
  for (const f of funcionarios) {
    if (f.posto_id) {
      efetivoMap.set(f.posto_id, (efetivoMap.get(f.posto_id) ?? 0) + 1)
    }
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
