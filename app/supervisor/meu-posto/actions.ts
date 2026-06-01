'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'

export async function registrarAtestadoSupervisor(formData: FormData) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')

  const funcionario_id = formData.get('funcionario_id') as string
  const posto_id       = formData.get('posto_id') as string
  const data_inicio    = formData.get('data_inicio') as string
  const data_fim       = formData.get('data_fim') as string
  const motivo         = (formData.get('motivo') as string) || null

  await Promise.all([
    supabase.from('atestados').insert({
      funcionario_id,
      posto_id,
      data_inicio,
      data_fim,
      motivo,
      registrado_por: auth.user.id,
    }),
    supabase
      .from('funcionarios')
      .update({ status: 'afastado' })
      .eq('id', funcionario_id),
  ])

  revalidatePath('/supervisor/meu-posto')
}
