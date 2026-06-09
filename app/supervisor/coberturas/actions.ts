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

function calcUrgencia(dataPrevRetorno: string | null): 'baixa' | 'media' | 'alta' {
  if (!dataPrevRetorno) return 'baixa'
  const hoje = new Date()
  const hojeNorm = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const [y, m, d] = dataPrevRetorno.split('-').map(Number)
  const dt   = new Date(y, m - 1, d)
  const diff = Math.ceil((dt.getTime() - hojeNorm.getTime()) / 86_400_000)
  if (diff <= 1) return 'alta'
  if (diff <= 3) return 'media'
  return 'baixa'
}

export async function registrarCobertura(formData: FormData): Promise<ActionResult> {
  const guard = await assertAuth()
  if (!guard.success) return guard

  const supabase = createClient()

  const funcionario_id    = formData.get('substituto_id') as string
  const posto_destino_id  = formData.get('posto_destino_id') as string
  const posto_origem_id   = (formData.get('posto_origem_id') as string) || null
  const motivo            = (formData.get('motivo') as string) || null
  const data_inicio       = formData.get('data_inicio') as string
  const data_prev_retorno = (formData.get('data_fim') as string) || null

  const urgencia = calcUrgencia(data_prev_retorno)

  const { error } = await supabase.from('coberturas_temporarias').insert({
    funcionario_id,
    posto_destino_id,
    posto_origem_id,
    motivo,
    data_inicio,
    data_prev_retorno,
    urgencia,
    status: 'ativa',
  })

  if (error) return { success: false, error: error.message }

  await supabase
    .from('funcionarios')
    .update({ posto_id: posto_destino_id })
    .eq('id', funcionario_id)

  revalidatePath('/supervisor/coberturas')
  return { success: true }
}

export async function encerrarCobertura(id: string): Promise<ActionResult> {
  const guard = await assertAuth()
  if (!guard.success) return guard

  const supabase = createClient()
  const hoje     = new Date().toISOString().split('T')[0]

  const { error } = await supabase
    .from('coberturas_temporarias')
    .update({ status: 'encerrada', data_retorno_real: hoje })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/supervisor/coberturas')
  return { success: true }
}
