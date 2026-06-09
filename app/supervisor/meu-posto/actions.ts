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

export async function registrarAtestadoSupervisor(
  formData: FormData,
): Promise<ActionResult> {
  const guard = await assertAuth()
  if (!guard.success) return guard

  const supabase = createClient()

  const funcionario_id = formData.get('funcionario_id') as string
  const posto_id       = formData.get('posto_id') as string
  const data_inicio    = formData.get('data_inicio') as string
  const data_fim       = formData.get('data_fim') as string
  const motivo         = (formData.get('motivo') as string) || null

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status')
    .eq('id', funcionario_id)
    .single()

  const { error } = await supabase.from('atestados').insert({
    funcionario_id,
    posto_id,
    data_inicio,
    data_fim,
    motivo,
    registrado_por: guard.userId,
  })

  if (error) return { success: false, error: error.message }

  await Promise.all([
    supabase
      .from('funcionarios')
      .update({ status: 'afastado' })
      .eq('id', funcionario_id),
    supabase.from('movimentacoes').insert({
      funcionario_id,
      tipo:           'atestado',
      campo_alterado: 'status',
      valor_antes:    func?.status ?? null,
      valor_depois:   'afastado',
      executado_por:  guard.userId,
    }),
  ])

  revalidatePath('/supervisor/meu-posto')
  revalidatePath('/dashboard')
  return { success: true }
}
