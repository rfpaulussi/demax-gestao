'use server'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'
import { revalidatePath } from 'next/cache'

export async function saveEscala(
  posto_id: string,
  regime: string,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return { ok: false, error: 'Acesso negado' }
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('config_escalas_postos')
    .upsert({ posto_id, regime }, { onConflict: 'posto_id' })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/fechamento')
  revalidatePath('/fechamento/config-escalas')
  return { ok: true }
}
