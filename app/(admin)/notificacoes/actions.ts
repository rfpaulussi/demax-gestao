'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'

export async function marcarTodasLidas() {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) return
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('log_supervisor_acoes').update({ lido: true }).eq('lido', false)
}
