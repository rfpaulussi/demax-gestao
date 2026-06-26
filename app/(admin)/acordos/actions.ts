'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface AcordoPostoItem {
  id: string
  nome: string
  secretaria: string | null
}

export interface AcordoFuncionarioItem {
  id: string
  nome: string
  funcao: string | null
}

export type HorarioSemana = Record<string, string>

export interface AcordoCompensacao {
  id: string
  titulo: string
  tipo: 'individual' | 'coletivo'
  postos: AcordoPostoItem[]
  funcionarios: AcordoFuncionarioItem[]
  horario_semana: HorarioSemana
  descricao_acordo: string
  data_documento: string
  criado_por: string | null
  created_at: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

export async function listarAcordos(): Promise<AcordoCompensacao[]> {
  const supabase = createClient() as AnyClient
  const { data } = await supabase
    .from('acordos_compensacao')
    .select('*')
    .order('created_at', { ascending: false })
  return (data ?? []) as AcordoCompensacao[]
}

export async function criarAcordo(dados: {
  titulo: string
  tipo: 'individual' | 'coletivo'
  postos: AcordoPostoItem[]
  funcionarios: AcordoFuncionarioItem[]
  horario_semana: HorarioSemana
  descricao_acordo: string
  data_documento: string
}): Promise<{ id: string } | { error: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createAdminClient() as any)
    .from('acordos_compensacao')
    .insert(dados)
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/acordos')
  return { id: data.id }
}

export async function excluirAcordo(id: string): Promise<{ error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (createAdminClient() as any).from('acordos_compensacao').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/acordos')
  return {}
}

export async function buscarPostosParaAcordo(): Promise<AcordoPostoItem[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('postos')
    .select('id, nome, secretaria')
    .eq('ativo', true)
    .order('nome')
  return (data ?? []) as AcordoPostoItem[]
}

export async function buscarFuncionariosPorPostos(
  postoIds: string[]
): Promise<AcordoFuncionarioItem[]> {
  if (!postoIds.length) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('funcionarios')
    .select('id, nome, funcoes!funcao_id(nome)')
    .in('posto_id', postoIds)
    .in('status', ['ativo', 'ferias'])
    .order('nome')
  return ((data ?? []) as unknown as Array<{
    id: string
    nome: string
    funcoes: { nome: string } | null
  }>).map(f => ({ id: f.id, nome: f.nome, funcao: f.funcoes?.nome ?? null }))
}
