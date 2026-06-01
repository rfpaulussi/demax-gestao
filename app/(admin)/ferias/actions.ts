'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function registrarFerias(formData: FormData) {
  const supabase = createClient()

  const funcionarioId  = formData.get('funcionario_id') as string
  const dataInicio     = formData.get('data_inicio') as string
  const dataFim        = formData.get('data_fim') as string
  const observacao     = (formData.get('observacao') as string) || null

  await Promise.all([
    supabase.from('ferias').insert({
      funcionario_id: funcionarioId,
      data_inicio:    dataInicio,
      data_fim:       dataFim,
      observacao,
      status: 'agendada',
    }),
    supabase
      .from('funcionarios')
      .update({ status: 'ferias' })
      .eq('id', funcionarioId),
  ])

  revalidatePath('/ferias')
}

export async function concluirFerias(formData: FormData) {
  const supabase = createClient()

  const feriasId      = formData.get('ferias_id') as string
  const funcionarioId = formData.get('funcionario_id') as string

  await Promise.all([
    supabase
      .from('ferias')
      .update({ status: 'concluida' })
      .eq('id', feriasId),
    supabase
      .from('funcionarios')
      .update({ status: 'ativo' })
      .eq('id', funcionarioId),
  ])

  revalidatePath('/ferias')
}
