'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'

type ActionResult = { success: boolean; error?: string }

async function assertAdmin(): Promise<ActionResult | null> {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'admin') return { success: false, error: 'Acesso negado' }
  return null
}

export async function vincularPosto(supervisorId: string, postoId: string): Promise<ActionResult> {
  const denied = await assertAdmin()
  if (denied) return denied

  const admin = createAdminClient()
  // Upsert: se já existe registro (ativo=false), reativa; senão insere
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('config_supervisores_postos')
    .upsert(
      { supervisor_id: supervisorId, posto_id: postoId, ativo: true },
      { onConflict: 'supervisor_id,posto_id', ignoreDuplicates: false },
    )

  if (error) return { success: false, error: error.message }

  revalidatePath('/supervisores')
  return { success: true }
}

export async function desvincularPosto(supervisorId: string, postoId: string): Promise<ActionResult> {
  const denied = await assertAdmin()
  if (denied) return denied

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('config_supervisores_postos')
    .update({ ativo: false })
    .eq('supervisor_id', supervisorId)
    .eq('posto_id', postoId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/supervisores')
  return { success: true }
}

export async function transferirPostos(
  fromSupervisorId: string,
  toSupervisorId: string,
): Promise<ActionResult> {
  const denied = await assertAdmin()
  if (denied) return denied

  const supabase = createClient()
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any

  // Busca todos os postos ativos do supervisor de origem
  const { data: postos, error: fetchError } = await supabase
    .from('config_supervisores_postos')
    .select('posto_id')
    .eq('supervisor_id', fromSupervisorId)
    .eq('ativo', true)

  if (fetchError) return { success: false, error: fetchError.message }
  if (!postos || postos.length === 0) return { success: false, error: 'Nenhum posto ativo para transferir' }

  // Desvincula da origem
  const { error: desvError } = await adminAny
    .from('config_supervisores_postos')
    .update({ ativo: false })
    .eq('supervisor_id', fromSupervisorId)
    .eq('ativo', true)

  if (desvError) return { success: false, error: desvError.message }

  // Vincula ao destino (upsert para cada posto)
  const rows = postos.map(p => ({ supervisor_id: toSupervisorId, posto_id: p.posto_id, ativo: true }))
  const { error: vincError } = await adminAny
    .from('config_supervisores_postos')
    .upsert(rows, { onConflict: 'supervisor_id,posto_id', ignoreDuplicates: false })

  if (vincError) return { success: false, error: vincError.message }

  revalidatePath('/supervisores')
  return { success: true }
}
