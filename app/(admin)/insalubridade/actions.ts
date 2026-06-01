'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function registrarInsalubridade(formData: FormData) {
  const supabase = createClient()

  const funcionario_id = formData.get('funcionario_id') as string
  const posto_id       = formData.get('posto_id') as string
  const grau           = formData.get('grau') as 'minimo' | 'medio' | 'maximo'
  const percentual     = Number(formData.get('percentual'))
  const data_inicio    = formData.get('data_inicio') as string
  const data_fim       = (formData.get('data_fim') as string) || null

  await supabase.from('coberturas_insalubres').insert({
    funcionario_id,
    posto_id,
    grau,
    percentual,
    data_inicio,
    data_fim,
    status: 'pendente',
  })

  revalidatePath('/insalubridade')
}

export async function marcarEnviada(formData: FormData) {
  const supabase = createClient()

  const insalubridade_id = formData.get('insalubridade_id') as string

  await supabase
    .from('coberturas_insalubres')
    .update({ status: 'enviada' })
    .eq('id', insalubridade_id)

  revalidatePath('/insalubridade')
}

export async function enviarRelatorioRH() {
  const supabase = createClient()

  const now          = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  await supabase
    .from('coberturas_insalubres')
    .update({ status: 'enviada' })
    .eq('status', 'pendente')
    .gte('data_inicio', startOfMonth)
    .lte('data_inicio', endOfMonth)

  revalidatePath('/insalubridade')
}
