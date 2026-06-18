'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'

type ActionResult = { success: true } | { success: false; error: string }

async function assertAuth(): Promise<{ success: true; userId: string } | { success: false; error: string }> {
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }
  return { success: true, userId: auth.user.id }
}

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

export async function registrarCobertura(formData: FormData): Promise<ActionResult> {
  const guard = await assertAuth()
  if (!guard.success) return guard

  const supabase = createClient()

  // Bug fix: modal envia 'substituto_id', não 'funcionario_id'
  const substitutoId       = formData.get('substituto_id') as string
  const postoDestinoId     = formData.get('posto_destino_id') as string
  const motivo             = (formData.get('motivo') as string) || null
  const dataInicio         = formData.get('data_inicio') as string
  // Bug fix: modal envia 'data_fim', não 'data_prev_retorno'
  const dataPrevRetorno    = (formData.get('data_fim') as string) || null
  // Bug fix: modal envia 'funcionario_ausente_id', não 'ausente_id'
  const ausenteId          = (formData.get('funcionario_ausente_id') as string) || null
  const supervisorDestinoId = (formData.get('supervisor_id') as string) || null
  const tipoCobertura      = (formData.get('tipo_cobertura') as string) || null

  if (!substitutoId || !postoDestinoId || !dataInicio) {
    return { success: false, error: 'Campos obrigatórios faltando' }
  }

  // Fetch posto atual do substituto para usar como posto_origem
  const { data: substituto } = await supabase
    .from('funcionarios')
    .select('posto_id')
    .eq('id', substitutoId)
    .single()

  const postoOrigemId = substituto?.posto_id ?? null
  const urgencia      = calcUrgencia(dataPrevRetorno)

  const { error } = await supabase.from('coberturas_temporarias').insert({
    funcionario_id:        substitutoId,
    posto_destino_id:      postoDestinoId,
    posto_origem_id:       postoOrigemId,
    motivo,
    data_inicio:           dataInicio,
    data_prev_retorno:     dataPrevRetorno,
    urgencia,
    status:                'ativa',
    supervisor_origem_id:  guard.userId,
    supervisor_destino_id: supervisorDestinoId,
    funcionario_ausente_id: ausenteId,
    tipo_cobertura:        tipoCobertura,
  } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

  if (error) return { success: false, error: error.message }

  const { error: errSubstituto } = await supabase
    .from('funcionarios')
    .update({ posto_id: postoDestinoId })
    .eq('id', substitutoId)
  if (errSubstituto) console.error('[coberturas] registrarCobertura: atualizar posto do substituto:', errSubstituto.message)

  if (ausenteId) {
    const { error: errAusente } = await supabase
      .from('funcionarios')
      .update({ status: 'afastado' })
      .eq('id', ausenteId)
    if (errAusente) console.error('[coberturas] registrarCobertura: marcar ausente como afastado:', errAusente.message)
  }

  revalidatePath('/coberturas')
  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function encerrarCobertura(id: string): Promise<ActionResult> {
  const guard = await assertAuth()
  if (!guard.success) return guard

  const supabase = createClient()
  const hoje = new Date().toISOString().split('T')[0]

  const { data: cob, error: fetchError } = await supabase
    .from('coberturas_temporarias')
    .select('funcionario_id, posto_origem_id')
    .eq('id', id)
    .single()

  if (fetchError || !cob) return { success: false, error: 'Cobertura não encontrada' }

  const { error } = await supabase
    .from('coberturas_temporarias')
    .update({ status: 'encerrada', data_retorno_real: hoje })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  if (cob.posto_origem_id && cob.funcionario_id) {
    const { error: errRestore } = await supabase
      .from('funcionarios')
      .update({ posto_id: cob.posto_origem_id })
      .eq('id', cob.funcionario_id)
    if (errRestore) console.error('[coberturas] encerrarCobertura: restaurar posto do substituto:', errRestore.message)
  }

  revalidatePath('/coberturas')
  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function encerrarCoberturasVencidas(): Promise<{ encerradas: number }> {
  const supabase = createClient()
  const hoje = new Date().toISOString().split('T')[0]

  const { data: vencidas } = await supabase
    .from('coberturas_temporarias')
    .select('id, funcionario_id, posto_origem_id, posto_destino_id')
    .eq('status', 'ativa')
    .lt('data_prev_retorno', hoje)

  if (!vencidas || vencidas.length === 0) return { encerradas: 0 }

  for (const cob of vencidas) {
    const { error: errEnc } = await supabase
      .from('coberturas_temporarias')
      .update({ status: 'encerrada', data_retorno_real: hoje })
      .eq('id', cob.id)
    if (errEnc) {
      console.error('[coberturas] encerrarCoberturasVencidas: encerrar cobertura', cob.id, ':', errEnc.message)
      continue
    }

    if (cob.posto_origem_id && cob.funcionario_id) {
      const { error: errPosto } = await supabase
        .from('funcionarios')
        .update({ posto_id: cob.posto_origem_id })
        .eq('id', cob.funcionario_id)
      if (errPosto) console.error('[coberturas] encerrarCoberturasVencidas: restaurar posto', cob.funcionario_id, ':', errPosto.message)

      const { error: errHist } = await supabase.from('historico_funcionarios').insert({
        funcionario_id:   cob.funcionario_id,
        tipo:             'cobertura_encerrada_automatico',
        dados_anteriores: { posto_id: cob.posto_destino_id },
        dados_novos:      { posto_id: cob.posto_origem_id },
      } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      if (errHist) console.error('[coberturas] encerrarCoberturasVencidas: registrar historico', cob.funcionario_id, ':', errHist.message)
    }
  }

  revalidatePath('/coberturas')
  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
  return { encerradas: vencidas.length }
}

export async function buscarFuncionariosAtivosNoPostoSemAfastamento(
  postoId: string
): Promise<{ id: string; nome: string; funcao: string | null }[]> {
  const supabase = createClient()
  const hoje = new Date().toISOString().split('T')[0]

  const { data: funcionarios } = await supabase
    .from('funcionarios')
    .select('id, nome')
    .eq('posto_id', postoId)
    .eq('status', 'ativo')
    .order('nome')

  if (!funcionarios?.length) return []

  const ids = funcionarios.map(f => f.id)

  const [{ data: comAfastamento }, { data: comFalta }] = await Promise.all([
    supabase
      .from('afastamentos')
      .select('funcionario_id')
      .in('funcionario_id', ids)
      .lte('data_inicio', hoje)
      .or(`data_fim.is.null,data_fim.gte.${hoje}`),
    supabase
      .from('faltas')
      .select('funcionario_id')
      .in('funcionario_id', ids)
      .eq('data_falta', hoje),
  ])

  const excluir = new Set([
    ...(comAfastamento ?? []).map((r: { funcionario_id: string }) => r.funcionario_id),
    ...(comFalta ?? []).map((r: { funcionario_id: string }) => r.funcionario_id),
  ])

  return funcionarios
    .filter(f => !excluir.has(f.id))
    .map(f => ({ id: f.id, nome: f.nome, funcao: null }))
}

export async function buscarTodosSupervisores(): Promise<{ id: string; nome: string }[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('perfis')
    .select('id, nome')
    .eq('role', 'supervisor')
    .eq('ativo', true)
    .order('nome')
  return (data ?? []).map(s => ({ id: s.id, nome: s.nome ?? '' }))
}
