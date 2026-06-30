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
  postos: AcordoPostoItem[]
  funcionarios: AcordoFuncionarioItem[]
  horarios: TurnoHorario[]
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

  return ((data ?? []) as AnyClient[]).map(r => {
    const funcionarios = (r.funcionarios ?? []) as AcordoFuncionarioItem[]
    return {
      id: r.id,
      titulo: r.titulo,
      tipo: r.tipo,
      postos: r.postos ?? [],
      funcionarios,
      horarios: normalizarHorarios(r.horario_semana, funcionarios),
      descricao_acordo: r.descricao_acordo,
      data_documento: r.data_documento,
      criado_por: r.criado_por,
      created_at: r.created_at,
    } as AcordoCompensacao
  })
}

export async function criarAcordo(dados: {
  titulo: string
  tipo: 'individual' | 'coletivo'
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
