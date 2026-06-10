'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'

export type FaltaTipo = 'sem_justificativa' | 'declaracao'

export interface FaltaCompleta {
  id: string
  funcionario_id: string
  data_falta: string
  tipo: FaltaTipo
  dias: number
  observacao: string | null
  tem_documento: boolean
  justificativa: string | null
  registrado_por: string
  created_at: string
  funcionarios: {
    nome: string
    funcoes: { nome: string } | null
    postos: { nome: string; secretaria: string | null } | null
  } | null
  perfis: { nome: string | null } | null
}

export interface FuncOpt {
  id: string
  nome: string
  postos: { id: string; nome: string; secretaria: string | null } | null
  funcoes: { nome: string } | null
}

const FALTA_SELECT = `
  id, funcionario_id, data_falta, tipo, dias, observacao, registrado_por, created_at,
  funcionarios!funcionario_id (
    nome,
    funcoes!funcionarios_funcao_id_fkey ( nome ),
    postos!posto_id ( nome, secretaria )
  ),
  perfis!registrado_por ( nome )
`

export async function buscarFaltas(
  mes: number,
  ano: number,
): Promise<FaltaCompleta[]> {
  const supabase = createClient()
  const auth = await getUser()

  const mesStr     = String(mes).padStart(2, '0')
  const startDate  = `${ano}-${mesStr}-01`
  const daysInMonth = new Date(ano, mes, 0).getDate()
  const endDate    = `${ano}-${mesStr}-${String(daysInMonth).padStart(2, '0')}`

  let query = supabase
    .from('faltas')
    .select(FALTA_SELECT)
    .gte('data_falta', startDate)
    .lte('data_falta', endDate)
    .order('data_falta', { ascending: false })

  if (auth?.perfil.role !== 'admin') {
    const { data: cfgData } = await supabase
      .from('config_supervisores_postos')
      .select('posto_id')
      .eq('supervisor_id', auth!.user.id)
      .eq('ativo', true)
    const postoIds = (cfgData ?? []).map((r: { posto_id: string }) => r.posto_id)
    if (postoIds.length === 0) return []

    const { data: funcs } = await supabase
      .from('funcionarios')
      .select('id')
      .in('posto_id', postoIds)
    const funcIds = (funcs ?? []).map((f: { id: string }) => f.id)
    if (funcIds.length === 0) return []

    query = query.in('funcionario_id', funcIds)
  }

  const { data } = await query
  return (data ?? []) as unknown as FaltaCompleta[]
}

export async function criarFalta(formData: FormData) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado.')

  const funcionarioId = formData.get('funcionario_id') as string
  const dataFalta     = formData.get('data_falta') as string
  const tipo          = formData.get('tipo') as string

  if (!funcionarioId || !dataFalta || !tipo) {
    throw new Error('Campos obrigatórios ausentes: funcionário, data e tipo.')
  }

  const dias = Number(formData.get('dias') ?? 1)

  const { error } = await supabase.from('faltas').insert({
    funcionario_id: funcionarioId,
    data_falta:     dataFalta,
    tipo,
    dias:           isNaN(dias) || dias < 1 ? 1 : dias,
    observacao:     (formData.get('observacao') as string) || null,
    tem_documento:  formData.get('tem_documento') === 'true',
    justificativa:  (formData.get('justificativa') as string) || null,
    registrado_por: auth.user.id,
  })

  if (error) {
    if (error.code === '23505') throw new Error('Este funcionário já possui uma falta registrada nesta data com este tipo.')
    throw new Error(error.message)
  }

  revalidatePath('/faltas')
}

export async function removerFalta(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('faltas').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/faltas')
}

export async function buscarFuncionariosParaFalta(): Promise<FuncOpt[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('funcionarios')
    .select('id, nome, postos!posto_id(id, nome, secretaria), funcoes!funcionarios_funcao_id_fkey(nome)')
    .in('status', ['ativo', 'ferias', 'afastado'])
    .order('nome')
  return (data ?? []) as unknown as FuncOpt[]
}
