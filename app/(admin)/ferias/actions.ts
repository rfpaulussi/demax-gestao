'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function registrarFerias(formData: FormData) {
  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insert: any = {
    funcionario_id: formData.get('funcionario_id') as string,
    data_inicio: formData.get('data_inicio') as string,
    data_fim: formData.get('data_fim') as string,
    observacao: formData.get('observacao') as string || null,
    status: 'agendado',
  }
  const { error } = await supabase.from('ferias').insert(insert)

  if (error) throw new Error(error.message)
  revalidatePath('/ferias')
  return { ok: true }
}

export async function agendarFerias(data: {
  funcionario_id: string
  numero_periodo: number
  periodo_inicio: string
  periodo_fim: string
  limite_gozo: string
  dias_direito: number
  data_inicio: string
  data_fim: string
  observacao?: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const dias_utilizados = Math.ceil(
    (new Date(data.data_fim).getTime() - new Date(data.data_inicio).getTime())
    / (1000 * 60 * 60 * 24)
  ) + 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    funcionario_id: data.funcionario_id,
    numero_periodo: data.numero_periodo,
    periodo_inicio: data.periodo_inicio,
    periodo_fim: data.periodo_fim,
    limite_gozo: data.limite_gozo,
    dias_direito: data.dias_direito,
    data_inicio: data.data_inicio,
    data_fim: data.data_fim,
    dias_utilizados,
    observacao: data.observacao,
    status: 'agendado',
    criado_por: user.id,
  }
  const { error } = await supabase.from('ferias').insert(payload)

  if (error) throw new Error(error.message)
  revalidatePath('/ferias')
  return { ok: true }
}

export async function aprovarFerias(id: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = { status: 'aprovado', aprovado_por: user.id, aprovado_em: new Date().toISOString() }
  const { error } = await supabase.from('ferias').update(update).eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/ferias')
  revalidatePath('/aprovacoes')
  return { ok: true }
}

export async function concluirFerias(id: string) {
  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const concludeUpdate: any = { status: 'concluido' }
  const { error } = await supabase.from('ferias').update(concludeUpdate).eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/ferias')
  return { ok: true }
}

export async function cancelarFerias(id: string, motivo?: string) {
  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cancelUpdate: any = { status: 'cancelado', observacao: motivo }
  const { error } = await supabase.from('ferias').update(cancelUpdate).eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/ferias')
  return { ok: true }
}

export async function buscarFuncionarioParaFerias(nome: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('funcionarios')
    .select('id, nome, cpf, status, postos!posto_id(nome, secretaria)')
    .ilike('nome', `%${nome}%`)
    .eq('status', 'ativo')
    .limit(10)

  if (error) throw new Error(error.message)
  return data
}

export async function buscarPeriodosAquisitivos(funcionario_id: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('ferias')
    .select('id, numero_periodo, periodo_inicio, periodo_fim, limite_gozo, dias_direito, data_inicio, data_fim, status, dias_utilizados')
    .eq('funcionario_id', funcionario_id)
    .order('numero_periodo', { ascending: true })

  if (error) throw new Error(error.message)
  return data
}
