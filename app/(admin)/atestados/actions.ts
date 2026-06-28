'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'
import { logSupervisorAcao } from '@/lib/log-supervisor'

async function verificarAcessoAtestado(
  atestadoId: string,
  userId: string,
  role: string | null,
): Promise<boolean> {
  if (role === 'admin' || role === 'coordenador') return true
  const supabase = createClient()
  const { data: at } = await supabase
    .from('atestados').select('posto_id').eq('id', atestadoId).single()
  if (!at?.posto_id) return false
  const { data: cfg } = await supabase
    .from('config_supervisores_postos')
    .select('posto_id')
    .eq('supervisor_id', userId)
    .eq('posto_id', at.posto_id)
    .eq('ativo', true)
    .maybeSingle()
  return !!cfg
}

export async function updateAtestado(
  id: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const auth = await getUser()
  if (!auth) return { error: 'Não autenticado' }

  const temAcesso = await verificarAcessoAtestado(id, auth.user.id, auth.perfil.role)
  if (!temAcesso) return { error: 'Acesso negado' }

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

  if (auth.perfil.role === 'supervisor') {
    const { data: at } = await createAdminClient()
      .from('atestados').select('funcionarios!funcionario_id(nome)').eq('id', id).single()
    const nomeFuncionario = (at as any)?.funcionarios?.nome ?? null // eslint-disable-line @typescript-eslint/no-explicit-any
    await logSupervisorAcao({ supervisorId: auth.user.id, tipo: 'atestado', acao: 'editou', funcionarioNome: nomeFuncionario })
  }

  revalidatePath('/atestados')
  return {}
}

export async function deleteAtestado(id: string): Promise<{ error?: string }> {
  const auth = await getUser()
  if (!auth) return { error: 'Não autenticado' }

  const temAcesso = await verificarAcessoAtestado(id, auth.user.id, auth.perfil.role)
  if (!temAcesso) return { error: 'Acesso negado' }

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

  if (auth.perfil.role === 'supervisor') {
    const { data: func } = await adminSupabase
      .from('funcionarios').select('nome').eq('id', atestado?.funcionario_id ?? '').single()
    await logSupervisorAcao({ supervisorId: auth.user.id, tipo: 'atestado', acao: 'excluiu', funcionarioNome: (func as any)?.nome ?? null }) // eslint-disable-line @typescript-eslint/no-explicit-any
  }

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
