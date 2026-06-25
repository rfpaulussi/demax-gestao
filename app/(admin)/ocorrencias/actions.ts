'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'

export type OcorrenciaRow = {
  id: string
  tipo: 'ocorrencia' | 'alerta'
  titulo: string | null
  posto_nome: string
  secretaria: string
  supervisor_nome: string | null
  supervisor_id: string | null
  descricao: string
  data_ocorrencia: string
  data_lembrete: string | null
  gravidade: 'baixa' | 'media' | 'alta' | 'critica'
  status: 'aberta' | 'em_analise' | 'encerrada' | 'resolvido'
  created_at: string
}

export type PostoSimples = { id: string; nome: string; secretaria: string }
export type SupervisorSimples = { id: string; nome: string }

type ActionResult = { success: true } | { success: false; error: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }

type RawOcorrencia = {
  id: string
  posto_id: string | null
  supervisor_id: string | null
  titulo: string | null
  descricao: string | null
  data_ocorrencia: string | null
  gravidade: string | null
  status: string | null
  tipo: string | null
  data_lembrete: string | null
  created_at: string | null
}

export async function getOcorrenciasData(): Promise<OcorrenciaRow[]> {
  const supabase = createClient()
  const auth = await getUser()

  // Supervisores: busca ocorrências dos seus postos + alertas criados por eles
  // Alertas têm posto_id=null, então o RLS por posto os excluiria sem esse tratamento
  let ocorrenciasQuery = (supabase as unknown as AnyClient)
    .from('ocorrencias')
    .select('id, posto_id, supervisor_id, titulo, descricao, data_ocorrencia, gravidade, status, tipo, data_lembrete, created_at')
    .order('data_ocorrencia', { ascending: false })

  if (auth?.perfil.role === 'supervisor') {
    const { data: cfgData } = await supabase
      .from('config_supervisores_postos')
      .select('posto_id')
      .eq('supervisor_id', auth.user.id)
      .eq('ativo', true)
    const postoIds = (cfgData ?? []).map((r: { posto_id: string }) => r.posto_id)
    // OR: ocorrências dos postos do supervisor OU alertas criados pelo próprio supervisor
    ocorrenciasQuery = ocorrenciasQuery.or(
      `posto_id.in.(${postoIds.join(',')}),and(tipo.eq.alerta,supervisor_id.eq.${auth.user.id})`
    )
  }

  const [{ data: ocorrenciasRaw }, { data: postos }, { data: perfis }] = await Promise.all([
    ocorrenciasQuery,
    supabase.from('postos').select('id, nome, secretaria'),
    supabase.from('perfis').select('id, nome'),
  ])

  const ocorrencias = (ocorrenciasRaw ?? []) as RawOcorrencia[]

  const postosMap = new Map<string, { nome: string; secretaria: string }>()
  for (const p of postos ?? []) {
    postosMap.set(p.id, { nome: p.nome, secretaria: p.secretaria ?? '' })
  }

  const perfisMap = new Map<string, string>()
  for (const p of perfis ?? []) {
    if (p.nome) perfisMap.set(p.id, p.nome)
  }

  return ocorrencias.map(o => ({
    id: o.id,
    tipo: (o.tipo as OcorrenciaRow['tipo']) ?? 'ocorrencia',
    titulo: o.titulo ?? null,
    posto_nome: o.posto_id ? (postosMap.get(o.posto_id)?.nome ?? '—') : '—',
    secretaria: o.posto_id ? (postosMap.get(o.posto_id)?.secretaria ?? '') : '',
    supervisor_nome: o.supervisor_id ? (perfisMap.get(o.supervisor_id) ?? null) : null,
    supervisor_id: o.supervisor_id ?? null,
    descricao: o.descricao ?? '',
    data_ocorrencia: o.data_ocorrencia ?? '',
    data_lembrete: o.data_lembrete ?? null,
    gravidade: (o.gravidade ?? 'baixa') as OcorrenciaRow['gravidade'],
    status: (o.status ?? 'aberta') as OcorrenciaRow['status'],
    created_at: o.created_at ?? '',
  }))
}

export async function getPostosSimples(): Promise<PostoSimples[]> {
  const supabase = createClient()
  const auth = await getUser()

  let query = supabase
    .from('postos')
    .select('id, nome, secretaria')
    .eq('ativo', true)
    .order('nome')

  if (auth?.perfil.role === 'supervisor') {
    const { data: cfg } = await supabase
      .from('config_supervisores_postos')
      .select('posto_id')
      .eq('supervisor_id', auth.user.id)
      .eq('ativo', true)
    const ids = (cfg ?? []).map((r: { posto_id: string }) => r.posto_id)
    if (ids.length === 0) return []
    query = query.in('id', ids)
  }

  const { data } = await query
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
  const adminSupabase = createAdminClient()

  const posto_id        = formData.get('posto_id') as string
  const supervisor_id   = (formData.get('supervisor_id') as string) || null
  const descricao       = formData.get('descricao') as string
  const data_ocorrencia = formData.get('data_ocorrencia') as string
  const gravidade       = formData.get('gravidade') as string

  const { error } = await (adminSupabase as unknown as AnyClient).from('ocorrencias').insert({
    posto_id,
    supervisor_id,
    descricao,
    data_ocorrencia,
    gravidade,
    status: 'aberta',
    tipo: 'ocorrencia',
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/ocorrencias')
  return { success: true }
}

export async function criarAlerta(
  titulo: string,
  descricao: string,
  data_lembrete: string | null
): Promise<ActionResult> {
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }

  const adminSupabase = createAdminClient()

  const { error } = await (adminSupabase as unknown as AnyClient).from('ocorrencias').insert({
    supervisor_id:   auth.user.id,
    titulo,
    descricao,
    data_ocorrencia: new Date().toISOString().split('T')[0],
    data_lembrete:   data_lembrete || null,
    gravidade:       'baixa',
    status:          'aberta',
    tipo:            'alerta',
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/ocorrencias')
  return { success: true }
}

export async function resolverAlerta(id: string): Promise<ActionResult> {
  const adminSupabase = createAdminClient()

  const { error } = await (adminSupabase as unknown as AnyClient)
    .from('ocorrencias')
    .update({ status: 'resolvido' })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/ocorrencias')
  return { success: true }
}

export async function updateStatusOcorrencia(formData: FormData): Promise<ActionResult> {
  const adminSupabase = createAdminClient()

  const id     = formData.get('id') as string
  const status = formData.get('status') as string

  const { error } = await (adminSupabase as unknown as AnyClient)
    .from('ocorrencias')
    .update({ status })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/ocorrencias')
  return { success: true }
}
