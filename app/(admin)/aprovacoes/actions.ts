'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'
import type { TipoSolicitacao } from '@/types'

// ─── Tipos públicos ───────────────────────────────────────────────────────────

type ActionResult = { success: true; redirect_url?: string } | { success: false; error: string }

export type SolicitacaoFiltros = {
  tipo?: TipoSolicitacao
  status?: 'pendente' | 'aprovada' | 'rejeitada'
  supervisor_id?: string
}

export type SolicitacaoRow = {
  id: string
  tipo: TipoSolicitacao
  status: 'pendente' | 'aprovada' | 'rejeitada'
  motivo: string | null
  observacao_admin: string | null
  dados_antes: Record<string, unknown> | null
  dados_depois: Record<string, unknown> | null
  created_at: string | null
  funcionarios: { nome: string; cpf: string | null } | null
  perfis: { nome: string | null; email: string | null } | null
}

// ─── Helper interno ────────────────────────────────────────────────────────────

type AdminGuard =
  | { success: true; userId: string }
  | { success: false; error: string }

async function assertAdmin(): Promise<AdminGuard> {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'admin') {
    return { success: false, error: 'Acesso negado' }
  }
  return { success: true, userId: auth.user.id }
}

// ─── buscarSolicitacoes ────────────────────────────────────────────────────────

const SOL_SELECT = `
  id, tipo, status, motivo, observacao_admin, dados_antes, dados_depois, created_at,
  funcionarios!funcionario_id ( nome, cpf ),
  perfis!supervisor_id ( nome, email )
`

export async function buscarSolicitacoes(
  filtros: SolicitacaoFiltros = {},
): Promise<SolicitacaoRow[]> {
  const supabase = createClient()

  let query = supabase
    .from('solicitacoes')
    .select(SOL_SELECT)
    .order('created_at', { ascending: false })

  if (filtros.tipo)          query = query.eq('tipo', filtros.tipo as unknown as 'desligamento')
  if (filtros.status)        query = query.eq('status', filtros.status)
  if (filtros.supervisor_id) query = query.eq('supervisor_id', filtros.supervisor_id)

  const { data } = await query
  return (data ?? []) as unknown as SolicitacaoRow[]
}

// ─── aprovarSolicitacao ────────────────────────────────────────────────────────

export async function aprovarSolicitacao(
  id: string,
  observacao?: string,
): Promise<ActionResult> {
  const guard = await assertAdmin()
  if (!guard.success) return guard

  const supabase = createClient()

  const { data: sol, error: solError } = await supabase
    .from('solicitacoes')
    .select('*')
    .eq('id', id)
    .single()

  if (solError || !sol) return { success: false, error: 'Solicitação não encontrada' }
  if (sol.status !== 'pendente') return { success: false, error: 'Solicitação já processada' }

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status, posto_id, funcao_id, salario_base')
    .eq('id', sol.funcionario_id)
    .single()

  const dadosDepois = (sol.dados_depois ?? {}) as Record<string, unknown>

  switch (sol.tipo as TipoSolicitacao) {
    case 'desligamento': {
      const dataDesligamento = dadosDepois.data_desligamento as string | undefined
      await supabase
        .from('funcionarios')
        .update({ status: 'desligado', data_desligamento: dataDesligamento ?? null })
        .eq('id', sol.funcionario_id)
      break
    }

    case 'transferencia': {
      await supabase
        .from('funcionarios')
        .update({ posto_id: dadosDepois.posto_destino_id as string })
        .eq('id', sol.funcionario_id)
      break
    }

    case 'mudanca_funcao':
    case 'promocao': {
      await supabase
        .from('funcionarios')
        .update({ funcao_id: dadosDepois.funcao_destino_id as string })
        .eq('id', sol.funcionario_id)
      break
    }

    case 'alteracao_salario': {
      await supabase
        .from('funcionarios')
        .update({ salario_base: dadosDepois.novo_salario as number })
        .eq('id', sol.funcionario_id)
      break
    }

    case 'afastamento': {
      await supabase
        .from('funcionarios')
        .update({ status: 'afastado' })
        .eq('id', sol.funcionario_id)
      break
    }

    case 'retorno_afastamento': {
      await supabase
        .from('funcionarios')
        .update({
          status:   'ativo',
          posto_id: (dadosDepois.posto_retorno_id as string | undefined) ?? func?.posto_id ?? null,
        })
        .eq('id', sol.funcionario_id)
      break
    }

    case 'rescisao_indireta': {
      await supabase
        .from('funcionarios')
        .update({
          status:             'desligado',
          data_desligamento:  (dadosDepois.data_rescisao as string) ?? null,
        })
        .eq('id', sol.funcionario_id)
      break
    }

    case 'admissao': {
      const { data: novoFunc, error: errCreate } = await supabase
        .from('funcionarios')
        .insert({
          nome:          dadosDepois.nome as string,
          funcao_id:     dadosDepois.funcao_id as string,
          posto_id:      dadosDepois.posto_id as string,
          data_admissao: dadosDepois.data_admissao as string,
          status:        'ativo' as const,
        })
        .select('id')
        .single()

      if (errCreate || !novoFunc) {
        return { success: false, error: errCreate?.message ?? 'Erro ao criar funcionário' }
      }

      // Marcar criado_via (coluna nova, não está nos tipos gerados)
      await supabase
        .from('funcionarios')
        .update({ criado_via: 'solicitacao_admissao' } as unknown as { status: 'ativo' })
        .eq('id', novoFunc.id)

      await supabase.from('movimentacoes').insert({
        funcionario_id: novoFunc.id,
        tipo:           'admissao',
        campo_alterado: 'status',
        valor_antes:    null,
        valor_depois:   'ativo',
        executado_por:  guard.userId,
        solicitacao_id: id,
      })

      await supabase
        .from('solicitacoes')
        .update({
          status:           'aprovada',
          aprovado_por:     guard.userId,
          aprovado_em:      new Date().toISOString(),
          observacao_admin: observacao ?? null,
          funcionario_id:   novoFunc.id,
        })
        .eq('id', id)

      revalidatePath('/aprovacoes')
      revalidatePath('/efetivo')
      revalidatePath('/dashboard')
      revalidatePath('/pendencias')

      return { success: true, redirect_url: `/efetivo/${novoFunc.id}` }
    }
  }

  const campoMap: Partial<Record<TipoSolicitacao, { campo: string; antes: string | null; depois: string | null }>> = {
    desligamento:     { campo: 'status',       antes: func?.status ?? null,              depois: 'desligado' },
    transferencia:    { campo: 'posto_id',     antes: func?.posto_id ?? null,            depois: (dadosDepois.posto_destino_id as string) ?? null },
    mudanca_funcao:   { campo: 'funcao_id',    antes: func?.funcao_id ?? null,           depois: (dadosDepois.funcao_destino_id as string) ?? null },
    promocao:         { campo: 'funcao_id',    antes: func?.funcao_id ?? null,           depois: (dadosDepois.funcao_destino_id as string) ?? null },
    alteracao_salario:   { campo: 'salario_base', antes: String(func?.salario_base ?? ''), depois: String(dadosDepois.novo_salario ?? '') },
    afastamento:         { campo: 'status',       antes: func?.status ?? null,            depois: 'afastado'   },
    retorno_afastamento: { campo: 'status',       antes: func?.status ?? null,            depois: 'ativo'      },
    rescisao_indireta:   { campo: 'status',       antes: func?.status ?? null,            depois: 'desligado'  },
  }
  const mov = campoMap[sol.tipo]

  const { error: errMovAprov } = await supabase.from('movimentacoes').insert({
    funcionario_id:  sol.funcionario_id,
    tipo:            sol.tipo,
    campo_alterado:  mov?.campo ?? null,
    valor_antes:     mov?.antes ?? null,
    valor_depois:    mov?.depois ?? null,
    executado_por:   guard.userId,
    solicitacao_id:  id,
  })
  if (errMovAprov) console.error('[movimentacoes] aprovarSolicitacao:', errMovAprov.message)

  await supabase
    .from('solicitacoes')
    .update({
      status:           'aprovada',
      aprovado_por:     guard.userId,
      aprovado_em:      new Date().toISOString(),
      observacao_admin: observacao ?? null,
    })
    .eq('id', id)

  revalidatePath('/aprovacoes')
  revalidatePath('/efetivo')
  revalidatePath('/dashboard')

  return { success: true }
}

// ─── rejeitarSolicitacao ───────────────────────────────────────────────────────

export async function rejeitarSolicitacao(id: string, motivo: string): Promise<ActionResult> {
  const guard = await assertAdmin()
  if (!guard.success) return guard

  if (!motivo.trim()) return { success: false, error: 'Motivo da rejeição é obrigatório' }

  const supabase = createClient()

  const { error } = await supabase
    .from('solicitacoes')
    .update({
      status:           'rejeitada',
      aprovado_por:     guard.userId,
      aprovado_em:      new Date().toISOString(),
      observacao_admin: motivo,
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/aprovacoes')
  return { success: true }
}
