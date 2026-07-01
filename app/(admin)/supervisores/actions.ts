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

// Sem constraint unique na tabela: faz select → update-ou-insert manualmente
async function vincularPostoInterno(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminAny: any,
  supervisorId: string,
  postoId: string,
): Promise<string | null> {
  const { data: existing } = await adminAny
    .from('config_supervisores_postos')
    .select('id')
    .eq('supervisor_id', supervisorId)
    .eq('posto_id', postoId)
    .maybeSingle()

  if (existing) {
    const { error } = await adminAny
      .from('config_supervisores_postos')
      .update({ ativo: true })
      .eq('id', existing.id)
    return error?.message ?? null
  } else {
    const { error } = await adminAny
      .from('config_supervisores_postos')
      .insert({ supervisor_id: supervisorId, posto_id: postoId, ativo: true })
    return error?.message ?? null
  }
}

export async function vincularPosto(supervisorId: string, postoId: string): Promise<ActionResult> {
  const denied = await assertAdmin()
  if (denied) return denied

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = createAdminClient() as any
  const err = await vincularPostoInterno(adminAny, supervisorId, postoId)
  if (err) return { success: false, error: err }

  revalidatePath('/supervisores')
  return { success: true }
}

export async function desvincularPosto(supervisorId: string, postoId: string): Promise<ActionResult> {
  const denied = await assertAdmin()
  if (denied) return denied

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (createAdminClient() as any)
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = createAdminClient() as any

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

  // Vincula ao destino um por um (sem constraint unique)
  for (const { posto_id } of postos) {
    const err = await vincularPostoInterno(adminAny, toSupervisorId, posto_id)
    if (err) return { success: false, error: err }
  }

  revalidatePath('/supervisores')
  return { success: true }
}
