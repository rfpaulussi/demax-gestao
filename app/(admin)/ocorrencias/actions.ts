'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function encerrarOcorrencia(formData: FormData) {
  const supabase = createClient()

  const ocorrenciaId = formData.get('ocorrencia_id') as string

  await supabase
    .from('ocorrencias')
    .update({ status: 'encerrada' })
    .eq('id', ocorrenciaId)

  revalidatePath('/ocorrencias')
}
