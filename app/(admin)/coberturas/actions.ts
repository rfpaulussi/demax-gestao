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

export async function registrarCobertura(formData: FormData) {
  const supabase = createClient()

  const funcionarioId  = formData.get('funcionario_id') as string
  const postoOrigemId  = (formData.get('posto_origem_id') as string) || null
  const postoDestinoId = formData.get('posto_destino_id') as string
  const motivo         = (formData.get('motivo') as string) || null
  const dataInicio     = formData.get('data_inicio') as string
  const dataPrevRetorno = (formData.get('data_prev_retorno') as string) || null
  const ausenteId      = (formData.get('ausente_id') as string) || null

  const urgencia = calcUrgencia(dataPrevRetorno)

  const ops: Promise<unknown>[] = [
    supabase.from('coberturas_temporarias').insert({
      funcionario_id:   funcionarioId,
      posto_destino_id: postoDestinoId,
      posto_origem_id:  postoOrigemId,
      motivo,
      data_inicio:      dataInicio,
      data_prev_retorno: dataPrevRetorno,
      urgencia,
      status: 'ativa',
    }),
    supabase
      .from('funcionarios')
      .update({ posto_id: postoDestinoId })
      .eq('id', funcionarioId),
  ]

  if (ausenteId) {
    ops.push(
      supabase
        .from('funcionarios')
        .update({ status: 'afastado' })
        .eq('id', ausenteId),
    )
  }

  await Promise.all(ops)
  revalidatePath('/coberturas')
}

export async function encerrarCobertura(formData: FormData) {
  const supabase = createClient()

  const coberturaId   = formData.get('cobertura_id') as string
  const funcionarioId = formData.get('funcionario_id') as string
  const postoOrigemId = (formData.get('posto_origem_id') as string) || null

  const hoje = new Date().toISOString().split('T')[0]

  const ops: Promise<unknown>[] = [
    supabase
      .from('coberturas_temporarias')
      .update({ status: 'encerrada', data_retorno_real: hoje })
      .eq('id', coberturaId),
  ]

  if (postoOrigemId) {
    ops.push(
      supabase
        .from('funcionarios')
        .update({ posto_id: postoOrigemId })
        .eq('id', funcionarioId),
    )
  }

  await Promise.all(ops)
  revalidatePath('/coberturas')
}
