'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function registrarAdvertencia(formData: FormData) {
  const supabase = createClient()

  const funcionario_id  = formData.get('funcionario_id') as string
  const tipo            = formData.get('tipo') as string
  const data_ocorrencia = formData.get('data_ocorrencia') as string
  const descricao       = formData.get('descricao') as string

  await supabase.from('advertencias').insert({
    funcionario_id,
    tipo,
    data_ocorrencia,
    descricao,
    status: 'pendente',
  })

  revalidatePath('/advertencias')
}

export async function marcarEntregue(formData: FormData) {
  const supabase = createClient()

  const advertencia_id = formData.get('advertencia_id') as string

  await supabase
    .from('advertencias')
    .update({ status: 'entregue' })
    .eq('id', advertencia_id)

  revalidatePath('/advertencias')
}
