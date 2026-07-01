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
  status: string
}

export interface TurnoHorario {
  label: string
  horario: Record<string, string>   // dia -> "07:00 às 12:00 / 13:12 às 17:00"
  funcionario_ids: string[]
}

// ─── Normaliza horario_semana v1 ou v2 → TurnoHorario[] ──────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizarHorarios(raw: any, funcionarios: AcordoFuncionarioItem[]): TurnoHorario[] {
  if (!raw) return []
  if (raw._v === 2 && Array.isArray(raw.turnos)) return raw.turnos as TurnoHorario[]
  // v1: objeto dia→string, todos os funcionários num turno único
  return [{
    label: 'Turno Único',
    horario: raw as Record<string, string>,
    funcionario_ids: funcionarios.map(f => f.id),
  }]
}

export interface AcordoCompensacao {
  id: string
  titulo: string
  tipo: 'individual' | 'coletivo'
  subtipo: 'evento' | 'antecipado' | null
  postos: AcordoPostoItem[]
  funcionarios: AcordoFuncionarioItem[]
  horarios: TurnoHorario[]
  descricao_acordo: string
  data_documento: string
  criado_por: string | null
  criado_por_nome: string | null
  created_at: string
  entregue_rh: boolean
  entregue_em: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

export async function listarAcordos(filters?: {
  mes?: number
  ano?: number
}): Promise<AcordoCompensacao[]> {
  const supabase = createClient() as AnyClient

  let query = supabase
    .from('acordos_compensacao')
    .select('*')
    .order('data_documento', { ascending: false })

  if (filters?.mes && filters?.ano) {
    const y = filters.ano
    const m = String(filters.mes).padStart(2, '0')
    const nextM = filters.mes === 12 ? 1 : filters.mes + 1
    const nextY = filters.mes === 12 ? y + 1 : y
    query = query
      .gte('data_documento', `${y}-${m}-01`)
      .lt('data_documento', `${nextY}-${String(nextM).padStart(2, '0')}-01`)
  } else if (filters?.ano) {
    query = query
      .gte('data_documento', `${filters.ano}-01-01`)
      .lt('data_documento', `${filters.ano + 1}-01-01`)
  }

  const { data } = await query

  const rows = (data ?? []) as AnyClient[]

  // Resolve criado_por → nome via perfis
  const criadoPorIds = Array.from(new Set(rows.map((r: AnyClient) => r.criado_por).filter(Boolean))) as string[]
  const nomesMap: Record<string, string> = {}
  if (criadoPorIds.length > 0) {
    const { data: perfisData } = await (createClient() as AnyClient)
      .from('perfis')
      .select('id, nome')
      .in('id', criadoPorIds)
    for (const p of (perfisData ?? []) as { id: string; nome: string | null }[]) {
      if (p.nome) nomesMap[p.id] = p.nome
    }
  }

  return rows.map((r: AnyClient) => {
    const funcionarios = (r.funcionarios ?? []) as AcordoFuncionarioItem[]
    return {
      id:              r.id,
      titulo:          r.titulo,
      tipo:            r.tipo,
      subtipo:         r.subtipo ?? null,
      postos:          r.postos ?? [],
      funcionarios,
      horarios:        normalizarHorarios(r.horario_semana, funcionarios),
      descricao_acordo: r.descricao_acordo,
      data_documento:  r.data_documento,
      criado_por:      r.criado_por,
      criado_por_nome: r.criado_por ? (nomesMap[r.criado_por] ?? null) : null,
      created_at:      r.created_at,
      entregue_rh:     r.entregue_rh ?? false,
      entregue_em:     r.entregue_em ?? null,
    } as AcordoCompensacao
  })
}

export async function criarAcordo(dados: {
  titulo: string
  tipo: 'individual' | 'coletivo'
  subtipo: 'evento' | 'antecipado' | null
  postos: AcordoPostoItem[]
  funcionarios: AcordoFuncionarioItem[]
  horarios: TurnoHorario[]
  descricao_acordo: string
  data_documento: string
}): Promise<{ id: string } | { error: string }> {
  const { data, error } = await (createAdminClient() as AnyClient)
    .from('acordos_compensacao')
    .insert({
      titulo: dados.titulo,
      tipo: dados.tipo,
      subtipo: dados.subtipo,
      postos: dados.postos,
      funcionarios: dados.funcionarios,
      horario_semana: { _v: 2, turnos: dados.horarios },
      descricao_acordo: dados.descricao_acordo,
      data_documento: dados.data_documento,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/acordos')
  return { id: data.id }
}

export async function excluirAcordo(id: string): Promise<{ error?: string }> {
  const { error } = await (createAdminClient() as AnyClient).from('acordos_compensacao').delete().eq('id', id)
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
    .select('id, nome, status, funcoes!funcao_id(nome)')
    .in('posto_id', postoIds)
    .not('status', 'eq', 'desligado')
    .order('nome')
  return ((data ?? []) as unknown as Array<{
    id: string
    nome: string
    status: string
    funcoes: { nome: string } | null
  }>).map(f => ({ id: f.id, nome: f.nome, status: f.status, funcao: f.funcoes?.nome ?? null }))
}

export async function marcarEntregueRH(id: string): Promise<{ error?: string }> {
  const { error } = await (createAdminClient() as AnyClient)
    .from('acordos_compensacao')
    .update({ entregue_rh: true, entregue_em: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/acordos')
  return {}
}

export async function editarAcordo(
  id: string,
  dados: { titulo: string; data_documento: string; descricao_acordo: string; subtipo?: 'evento' | 'antecipado' | null }
): Promise<{ error?: string }> {
  const { error } = await (createAdminClient() as AnyClient)
    .from('acordos_compensacao')
    .update({
      titulo: dados.titulo,
      data_documento: dados.data_documento,
      descricao_acordo: dados.descricao_acordo,
      subtipo: dados.subtipo ?? null,
    })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/acordos')
  return {}
}
