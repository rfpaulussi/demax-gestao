'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'

type ActionResult = { success: true } | { success: false; error: string }

type AuthGuard =
  | { success: true; userId: string }
  | { success: false; error: string }

async function assertAuth(): Promise<AuthGuard> {
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }
  return { success: true, userId: auth.user.id }
}

export async function registrarOcorrencia(formData: FormData): Promise<ActionResult> {
  const guard = await assertAuth()
  if (!guard.success) return guard

  const supabase = createClient()

  const posto_id        = formData.get('posto_id') as string
  const descricao       = formData.get('descricao') as string
  const gravidade       = (formData.get('gravidade') as 'baixa' | 'media' | 'alta') || null
  const data_ocorrencia = formData.get('data_ocorrencia') as string

  if (!descricao?.trim()) return { success: false, error: 'Descrição obrigatória' }

  const { error } = await supabase.from('ocorrencias').insert({
    posto_id,
    supervisor_id:  guard.userId,
    descricao,
    gravidade,
    data_ocorrencia,
    status: 'aberta',
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/supervisor/ocorrencias')
  return { success: true }
}

export async function encerrarOcorrenciaSupervisor(formData: FormData): Promise<ActionResult> {
  const guard = await assertAuth()
  if (!guard.success) return guard

  const supabase      = createClient()
  const ocorrencia_id = formData.get('ocorrencia_id') as string

  const { error } = await supabase
    .from('ocorrencias')
    .update({ status: 'encerrada' })
    .eq('id', ocorrencia_id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/supervisor/ocorrencias')
  return { success: true }
}
