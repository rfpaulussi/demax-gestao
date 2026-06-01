'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'

async function gerarPDFMovimentacao(_solicitacaoId: string): Promise<null> {
  return null
}

export async function aprovarSolicitacao(id: string, observacao?: string) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')
  if (auth.perfil.role !== 'admin') throw new Error('Acesso negado')

  const { data: sol } = await supabase
    .from('solicitacoes')
    .select('*')
    .eq('id', id)
    .single()

  if (!sol) throw new Error('Solicitação não encontrada')
  if (sol.status !== 'pendente') throw new Error('Solicitação já processada')

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status, posto_id, funcao_id')
    .eq('id', sol.funcionario_id)
    .single()

  const dadosDepois = (sol.dados_depois ?? {}) as Record<string, unknown>
  const now = new Date().toISOString()

  switch (sol.tipo) {
    case 'desligamento': {
      const dataDesligamento = dadosDepois.data_desligamento as string | undefined
      await supabase
        .from('funcionarios')
        .update({ status: 'desligado', data_desligamento: dataDesligamento ?? null })
        .eq('id', sol.funcionario_id)
      break
    }

    case 'transferencia': {
      const postoDestinoId = dadosDepois.posto_destino_id as string
      await supabase
        .from('funcionarios')
        .update({ posto_id: postoDestinoId })
        .eq('id', sol.funcionario_id)
      break
    }

    case 'mudanca_funcao':
    case 'promocao': {
      const funcaoDestinoId = dadosDepois.funcao_destino_id as string
      await supabase
        .from('funcionarios')
        .update({ funcao_id: funcaoDestinoId })
        .eq('id', sol.funcionario_id)
      break
    }

    case 'mudanca_supervisor': {
      const novoSupervisorId = dadosDepois.novo_supervisor_id as string
      const postoId = func?.posto_id
      if (postoId) {
        await supabase
          .from('config_supervisores_postos')
          .update({ ativo: false })
          .eq('posto_id', postoId)
          .eq('ativo', true)
        await supabase
          .from('config_supervisores_postos')
          .insert({ supervisor_id: novoSupervisorId, posto_id: postoId, ativo: true })
      }
      break
    }
  }

  const campoMap: Record<string, { campo: string; antes: string | null; depois: string | null }> = {
    desligamento:       { campo: 'status',    antes: func?.status ?? null,    depois: 'desligado' },
    transferencia:      { campo: 'posto_id',  antes: func?.posto_id ?? null,  depois: dadosDepois.posto_destino_id as string ?? null },
    mudanca_funcao:     { campo: 'funcao_id', antes: func?.funcao_id ?? null, depois: dadosDepois.funcao_destino_id as string ?? null },
    promocao:           { campo: 'funcao_id', antes: func?.funcao_id ?? null, depois: dadosDepois.funcao_destino_id as string ?? null },
    mudanca_supervisor: { campo: 'supervisor_id', antes: null,               depois: dadosDepois.novo_supervisor_id as string ?? null },
  }
  const mov = campoMap[sol.tipo]

  await supabase.from('movimentacoes').insert({
    funcionario_id: sol.funcionario_id,
    tipo: sol.tipo,
    campo_alterado: mov?.campo ?? null,
    valor_antes: mov?.antes ?? null,
    valor_depois: mov?.depois ?? null,
    executado_por: auth.user.id,
    solicitacao_id: id,
  })

  await supabase
    .from('solicitacoes')
    .update({
      status: 'aprovada',
      aprovado_por: auth.user.id,
      aprovado_em: now,
      observacao_admin: observacao ?? null,
    })
    .eq('id', id)

  if (sol.tipo === 'mudanca_funcao') {
    await gerarPDFMovimentacao(id)
  }

  revalidatePath('/aprovacoes')
  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
}

export async function rejeitarSolicitacao(id: string, motivo: string) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')
  if (auth.perfil.role !== 'admin') throw new Error('Acesso negado')

  if (!motivo.trim()) throw new Error('Motivo obrigatório')

  await supabase
    .from('solicitacoes')
    .update({
      status: 'rejeitada',
      aprovado_por: auth.user.id,
      aprovado_em: new Date().toISOString(),
      observacao_admin: motivo,
    })
    .eq('id', id)

  revalidatePath('/aprovacoes')
}
