'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'

export async function registrarOcorrencia(formData: FormData) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')

  const posto_id       = formData.get('posto_id') as string
  const descricao      = formData.get('descricao') as string
  const gravidade      = formData.get('gravidade') as string
  const data_ocorrencia = formData.get('data_ocorrencia') as string

  await supabase.from('ocorrencias').insert({
    posto_id,
    supervisor_id: auth.user.id,
    descricao,
    gravidade,
    data_ocorrencia,
    status: 'aberta',
  })

  revalidatePath('/supervisor/ocorrencias')
}

export async function encerrarOcorrenciaSupervisor(formData: FormData) {
  const supabase = createClient()

  const ocorrencia_id = formData.get('ocorrencia_id') as string

  await supabase
    .from('ocorrencias')
    .update({ status: 'encerrada' })
    .eq('id', ocorrencia_id)

  revalidatePath('/supervisor/ocorrencias')
}
