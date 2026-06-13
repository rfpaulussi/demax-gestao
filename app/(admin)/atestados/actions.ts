'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'

export async function updateAtestado(
  id: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const auth = await getUser()
  if (!auth) return { error: 'Não autenticado' }

  const supabase = createClient()

  const { error } = await supabase
    .from('atestados')
    .update({
      data_inicio: formData.get('data_inicio') as string,
      data_fim: formData.get('data_fim') as string,
      motivo: (formData.get('motivo') as string) || null,
      cid_codigo: (formData.get('cid_codigo') as string) || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/atestados')
  return {}
}

export async function deleteAtestado(id: string): Promise<{ error?: string }> {
  const auth = await getUser()
  if (!auth) return { error: 'Não autenticado' }

  const supabase = createClient()

  const { error } = await supabase.from('atestados').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/atestados')
  return {}
}
