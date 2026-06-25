'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'

export async function updateAtestado(
  id: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const auth = await getUser()
  if (!auth) return { error: 'Não autenticado' }

  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase
    .from('atestados')
    .update({
      data_inicio:        formData.get('data_inicio') as string,
      data_fim:           formData.get('data_fim') as string,
      motivo:             (formData.get('motivo') as string) || null,
      cid_codigo:         (formData.get('cid_codigo') as string) || null,
      origem_ocupacional: ((formData.get('origem_ocupacional') as string) || null) as 'acidente_trabalho' | 'doenca_ocupacional' | null,
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
  const adminSupabase = createAdminClient()

  // Lê o atestado antes de excluir para registrar no log
  const { data: atestado } = await supabase
    .from('atestados')
    .select('funcionario_id, data_inicio, data_fim, cid_codigo')
    .eq('id', id)
    .single()

  const { error } = await adminSupabase.from('atestados').delete().eq('id', id)

  if (error) return { error: error.message }

  if (atestado) {
    await adminSupabase.from('movimentacoes').insert({
      funcionario_id: atestado.funcionario_id,
      tipo:           'exclusao_atestado',
      campo_alterado: 'atestado',
      valor_antes:    `${atestado.data_inicio} → ${atestado.data_fim}${atestado.cid_codigo ? ` (${atestado.cid_codigo})` : ''}`,
      valor_depois:   null,
      executado_por:  auth.user.id,
    })
  }

  revalidatePath('/atestados')
  return {}
}
