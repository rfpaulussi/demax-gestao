'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function calcUrgencia(dataPrevRetorno: string | null): 'baixa' | 'media' | 'alta' {
  if (!dataPrevRetorno) return 'baixa'
  const hoje = new Date()
  const hojeDate = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const [y, m, d] = dataPrevRetorno.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const diff = Math.ceil((dt.getTime() - hojeDate.getTime()) / 86_400_000)
  if (diff <= 1) return 'alta'
  if (diff <= 3) return 'media'
  return 'baixa'
}

export async function registrarCoberturasSupervisor(formData: FormData) {
  const supabase = createClient()

  const funcionario_id    = formData.get('funcionario_id') as string
  const posto_destino_id  = formData.get('posto_destino_id') as string
  const posto_origem_id   = (formData.get('posto_origem_id') as string) || null
  const motivo            = (formData.get('motivo') as string) || null
  const data_inicio       = formData.get('data_inicio') as string
  const data_prev_retorno = (formData.get('data_prev_retorno') as string) || null

  const urgencia = calcUrgencia(data_prev_retorno)

  await Promise.all([
    supabase.from('coberturas_temporarias').insert({
      funcionario_id,
      posto_destino_id,
      posto_origem_id,
      motivo,
      data_inicio,
      data_prev_retorno,
      urgencia,
      status: 'ativa',
    }),
    supabase
      .from('funcionarios')
      .update({ posto_id: posto_destino_id })
      .eq('id', funcionario_id),
  ])

  revalidatePath('/supervisor/coberturas')
}

export async function encerrarCoberturasSupervisor(formData: FormData) {
  const supabase = createClient()

  const cobertura_id    = formData.get('cobertura_id') as string
  const funcionario_id  = formData.get('funcionario_id') as string
  const posto_origem_id = (formData.get('posto_origem_id') as string) || null

  const hoje = new Date().toISOString().split('T')[0]

  const ops: Promise<unknown>[] = [
    supabase
      .from('coberturas_temporarias')
      .update({ status: 'encerrada', data_retorno_real: hoje })
      .eq('id', cobertura_id),
  ]

  if (posto_origem_id) {
    ops.push(
      supabase
        .from('funcionarios')
        .update({ posto_id: posto_origem_id })
        .eq('id', funcionario_id),
    )
  }

  await Promise.all(ops)
  revalidatePath('/supervisor/coberturas')
}
