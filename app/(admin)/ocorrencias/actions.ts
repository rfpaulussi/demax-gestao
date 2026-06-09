'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type OcorrenciaRow = {
  id: string
  posto_nome: string
  secretaria: string
  supervisor_nome: string | null
  descricao: string
  data_ocorrencia: string
  gravidade: 'baixa' | 'media' | 'alta' | 'critica'
  status: 'aberta' | 'em_analise' | 'encerrada'
  created_at: string
}

export type PostoSimples = { id: string; nome: string; secretaria: string }
export type SupervisorSimples = { id: string; nome: string }

type ActionResult = { success: true } | { success: false; error: string }

export async function getOcorrenciasData(): Promise<OcorrenciaRow[]> {
  const supabase = createClient()

  const [{ data: ocorrencias }, { data: postos }, { data: perfis }] = await Promise.all([
    supabase
      .from('ocorrencias')
      .select('id, posto_id, supervisor_id, descricao, data_ocorrencia, gravidade, status, created_at')
      .order('data_ocorrencia', { ascending: false }),
    supabase.from('postos').select('id, nome, secretaria'),
    supabase.from('perfis').select('id, nome'),
  ])

  const postosMap = new Map<string, { nome: string; secretaria: string }>()
  for (const p of postos ?? []) {
    postosMap.set(p.id, { nome: p.nome, secretaria: p.secretaria ?? '' })
  }

  const perfisMap = new Map<string, string>()
  for (const p of perfis ?? []) {
    if (p.nome) perfisMap.set(p.id, p.nome)
  }

  return (ocorrencias ?? []).map(o => ({
    id: o.id,
    posto_nome: postosMap.get(o.posto_id)?.nome ?? '—',
    secretaria: postosMap.get(o.posto_id)?.secretaria ?? '',
    supervisor_nome: o.supervisor_id ? (perfisMap.get(o.supervisor_id) ?? null) : null,
    descricao: o.descricao ?? '',
    data_ocorrencia: o.data_ocorrencia ?? '',
    gravidade: o.gravidade as OcorrenciaRow['gravidade'],
    status: o.status as OcorrenciaRow['status'],
    created_at: o.created_at ?? '',
  }))
}

export async function getPostosSimples(): Promise<PostoSimples[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('postos')
    .select('id, nome, secretaria')
    .eq('ativo', true)
    .order('nome')
  return (data ?? []).map(p => ({ id: p.id, nome: p.nome, secretaria: p.secretaria ?? '' }))
}

export async function getSupervisoresSimples(): Promise<SupervisorSimples[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('perfis')
    .select('id, nome')
    .eq('role', 'supervisor')
    .eq('ativo', true)
    .order('nome')
  return (data ?? []).map(p => ({ id: p.id, nome: p.nome ?? '' }))
}

export async function createOcorrencia(formData: FormData): Promise<ActionResult> {
  const supabase = createClient()

  const posto_id        = formData.get('posto_id') as string
  const supervisor_id   = (formData.get('supervisor_id') as string) || null
  const descricao       = formData.get('descricao') as string
  const data_ocorrencia = formData.get('data_ocorrencia') as string
  const gravidade       = formData.get('gravidade') as string

  const { error } = await supabase.from('ocorrencias').insert({
    posto_id,
    supervisor_id: supervisor_id as string,
    descricao,
    data_ocorrencia,
    gravidade: gravidade as 'baixa' | 'media' | 'alta',
    status: 'aberta',
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/ocorrencias')
  return { success: true }
}

export async function updateStatusOcorrencia(formData: FormData): Promise<ActionResult> {
  const supabase = createClient()

  const id     = formData.get('id') as string
  const status = formData.get('status') as string

  const { error } = await supabase
    .from('ocorrencias')
    .update({ status: status as 'aberta' | 'em_analise' | 'encerrada' })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/ocorrencias')
  return { success: true }
}
