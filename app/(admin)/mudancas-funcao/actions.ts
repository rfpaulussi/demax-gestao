'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }

type ActionResult = { success: true } | { success: false; error: string }

async function assertAdmin(): Promise<{ success: true; userId: string } | { success: false; error: string }> {
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }
  if (auth.perfil.role !== 'admin') return { success: false, error: 'Sem permissão de admin' }
  return { success: true, userId: auth.user.id }
}

export async function editarMudancaFuncao(fd: FormData): Promise<ActionResult> {
  const guard = await assertAdmin()
  if (!guard.success) return guard

  const movId         = fd.get('movimentacao_id') as string
  const solId         = (fd.get('solicitacao_id') as string) || null
  const funcaoId      = fd.get('funcao_id') as string
  const funcaoNome    = fd.get('funcao_nome') as string
  const motivo        = (fd.get('motivo') as string) || null
  const vigencia      = (fd.get('vigencia') as string) || null
  const funcionarioId = fd.get('funcionario_id') as string

  if (!movId || !funcaoId || !funcionarioId) {
    return { success: false, error: 'Campos obrigatórios faltando' }
  }

  const supabase = createClient()

  // 1. Atualiza movimentacoes.valor_depois com o novo funcao_id
  const { error: errMov } = await supabase
    .from('movimentacoes')
    .update({ valor_depois: funcaoId } as never)
    .eq('id', movId)
  if (errMov) return { success: false, error: errMov.message }

  // 2. Atualiza solicitacoes: JSONB dados_depois + motivo + vigência
  if (solId) {
    const { data: sol } = await (supabase as unknown as AnyClient)
      .from('solicitacoes')
      .select('dados_depois')
      .eq('id', solId)
      .single()

    if (sol) {
      const dadosDepois = {
        ...((sol.dados_depois as Record<string, unknown>) ?? {}),
        funcao_destino_nome: funcaoNome,
        funcao_destino_id:   funcaoId,
      }
      const updatePayload: Record<string, unknown> = { dados_depois: dadosDepois, motivo }
      if (vigencia) updatePayload.vigencia = vigencia

      const { error: errSol } = await (supabase as unknown as AnyClient)
        .from('solicitacoes')
        .update(updatePayload)
        .eq('id', solId)
      if (errSol) console.error('[mudancas-funcao] editarMudancaFuncao: update solicitacao:', errSol.message)
    }
  }

  // 3. Atualiza funcionarios.funcao_id
  const { error: errFunc } = await supabase
    .from('funcionarios')
    .update({ funcao_id: funcaoId } as never)
    .eq('id', funcionarioId)
  if (errFunc) return { success: false, error: errFunc.message }

  revalidatePath('/mudancas-funcao')
  revalidatePath('/efetivo')
  return { success: true }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function excluirMudancaFuncao(fd: FormData): Promise<ActionResult> {
  const guard = await assertAdmin()
  if (!guard.success) return guard

  const movId            = fd.get('movimentacao_id') as string
  const solId            = (fd.get('solicitacao_id') as string) || null
  const funcionarioId    = fd.get('funcionario_id') as string
  const funcaoAnteriorId = (fd.get('funcao_anterior_id') as string) || null

  if (!movId || !funcionarioId) {
    return { success: false, error: 'Campos obrigatórios faltando' }
  }

  const supabase = createClient()

  // 1. Deleta a movimentação pelo id específico (não por funcionario_id)
  const { error: errMov } = await supabase
    .from('movimentacoes')
    .delete()
    .eq('id', movId)
  if (errMov) return { success: false, error: errMov.message }

  // 2. Deleta a solicitação vinculada pelo id específico (não por funcionario_id)
  if (solId) {
    const { error: errSol } = await (supabase as unknown as AnyClient)
      .from('solicitacoes')
      .delete()
      .eq('id', solId)
    if (errSol) console.error('[mudancas-funcao] excluirMudancaFuncao: delete solicitacao:', errSol.message)
  }

  // 3. Reverte a função do funcionário — somente se valor_antes for um UUID válido
  if (funcaoAnteriorId && UUID_RE.test(funcaoAnteriorId)) {
    const { error: errFunc } = await supabase
      .from('funcionarios')
      .update({ funcao_id: funcaoAnteriorId } as never)
      .eq('id', funcionarioId)
    if (errFunc) return { success: false, error: errFunc.message }
  }

  revalidatePath('/mudancas-funcao')
  revalidatePath('/efetivo')
  return { success: true }
}
