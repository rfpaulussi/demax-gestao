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
  funcionario_id: string | null
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

const SOL_SELECT_COM_CPF = `
  id, funcionario_id, tipo, status, motivo, observacao_admin, dados_antes, dados_depois, created_at,
  funcionarios!funcionario_id ( nome, cpf ),
  perfis!supervisor_id ( nome, email )
`

const SOL_SELECT_SEM_CPF = `
  id, funcionario_id, tipo, status, motivo, observacao_admin, dados_antes, dados_depois, created_at,
  funcionarios!funcionario_id ( nome ),
  perfis!supervisor_id ( nome, email )
`


export async function buscarSolicitacoes(
  filtros: SolicitacaoFiltros = {},
): Promise<SolicitacaoRow[]> {
  const auth = await getUser()
  if (!auth) return []

  const podeVerCpf = auth.perfil.role === 'admin' || auth.perfil.role === 'coordenador'
  const supabase = createClient()

  let query = supabase
    .from('solicitacoes')
    .select(podeVerCpf ? SOL_SELECT_COM_CPF : SOL_SELECT_SEM_CPF)
    .order('created_at', { ascending: false })

  if (filtros.tipo)          query = query.eq('tipo', filtros.tipo as unknown as 'desligamento')
  if (filtros.status)        query = query.eq('status', filtros.status)
  if (filtros.supervisor_id) query = query.eq('supervisor_id', filtros.supervisor_id)

  const { data } = await query
  const rows = (data ?? []) as unknown as SolicitacaoRow[]

  // Para roles sem acesso ao CPF completo, garantimos que nenhum dado vaze
  if (!podeVerCpf) {
    return rows.map(r => ({
      ...r,
      funcionarios: r.funcionarios ? { nome: r.funcionarios.nome, cpf: null } : null,
    }))
  }

  return rows
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
  if (!sol.funcionario_id && sol.tipo !== 'admissao') return { success: false, error: 'Funcionário não vinculado à solicitação' }

  const funcionarioId = sol.funcionario_id as string

  const { data: func } = sol.funcionario_id
    ? await supabase
        .from('funcionarios')
        .select('status, posto_id, funcao_id, salario')
        .eq('id', sol.funcionario_id)
        .single()
    : { data: null }

  const dadosDepois = (sol.dados_depois ?? {}) as Record<string, unknown>
  const dadosAntes  = (sol.dados_antes  ?? {}) as Record<string, unknown>

  switch (sol.tipo as TipoSolicitacao) {
    case 'desligamento': {
      const dataDesligamento = dadosDepois.data_desligamento as string | undefined
      await supabase
        .from('funcionarios')
        .update({
          status:              'desligado',
          data_desligamento:   dataDesligamento ?? null,
          motivo_desligamento: (dadosDepois.motivo as string) ?? null,
        })
        .eq('id', funcionarioId)
      break
    }

    case 'transferencia': {
      const updateTransf: Record<string, unknown> = { posto_id: dadosDepois.posto_destino_id as string }
      if (dadosDepois.nova_funcao_id) updateTransf.funcao_id = dadosDepois.nova_funcao_id as string
      await supabase
        .from('funcionarios')
        .update(updateTransf as { posto_id: string })
        .eq('id', funcionarioId)
      if (dadosDepois.nova_funcao_id) {
        await supabase.from('movimentacoes').insert({
          funcionario_id:  funcionarioId,
          tipo:            'mudanca_funcao',
          campo_alterado:  'funcao_id',
          valor_antes:     func?.funcao_id ?? null,
          valor_depois:    dadosDepois.nova_funcao_id as string,
          executado_por:   guard.userId,
          solicitacao_id:  id,
        })
      }
      break
    }

    case 'mudanca_funcao':
    case 'promocao': {
      await supabase
        .from('funcionarios')
        .update({ funcao_id: dadosDepois.funcao_destino_id as string })
        .eq('id', funcionarioId)
      break
    }

    case 'alteracao_salario': {
      await supabase
        .from('funcionarios')
        .update({ salario: dadosDepois.novo_salario as number })
        .eq('id', funcionarioId)
      break
    }

    case 'afastamento': {
      const motivoAfastamento = String(dadosDepois.motivo ?? '').toUpperCase().startsWith('INSS')
        ? 'inss'
        : 'ausencia_temporaria'
      await supabase
        .from('funcionarios')
        .update({ status: 'afastado', motivo_afastamento: motivoAfastamento })
        .eq('id', funcionarioId)
      await supabase.from('afastamentos').insert({
        funcionario_id:    funcionarioId,
        motivo:            (dadosDepois.motivo as string | null) ?? null,
        data_inicio:       dadosDepois.data_inicio as string,
        data_fim_prevista: (dadosDepois.data_retorno_prevista as string | null) ?? null,
        solicitacao_id:    sol.id,
      })
      break
    }

    case 'retorno_afastamento': {
      await supabase
        .from('funcionarios')
        .update({
          status:   'ativo',
          posto_id: (dadosDepois.posto_retorno_id as string | undefined) ?? func?.posto_id ?? null,
        })
        .eq('id', funcionarioId)
      await supabase
        .from('afastamentos')
        .update({ data_fim_real: dadosDepois.data_retorno as string })
        .eq('funcionario_id', funcionarioId)
        .is('data_fim_real', null)
      break
    }

    case 'rescisao_indireta': {
      await supabase
        .from('funcionarios')
        .update({
          status:              'desligado',
          data_desligamento:   (dadosDepois.data_rescisao as string) ?? null,
          motivo_desligamento: (dadosDepois.motivo as string) ?? sol.motivo ?? 'Rescisão Indireta',
        })
        .eq('id', funcionarioId)
      break
    }

    case 'admissao': {
      const periodoRaw = dadosDepois.periodo_experiencia as string | undefined
      const PERIODOS_VALIDOS = ['nenhum', '30+30', '45+45'] as const
      if (!periodoRaw || !(PERIODOS_VALIDOS as readonly string[]).includes(periodoRaw)) {
        return { success: false, error: 'Período de experiência inválido' }
      }
      const periodo_experiencia = periodoRaw === 'nenhum' ? null : periodoRaw as '30+30' | '45+45'

      const { data: novoFunc, error: errCreate } = await supabase
        .from('funcionarios')
        .insert({
          nome:                dadosDepois.nome as string,
          registro:            (dadosDepois.registro as string | undefined) ?? null,
          funcao_id:           dadosDepois.funcao_id as string,
          posto_id:            dadosDepois.posto_id as string,
          data_admissao:       dadosDepois.data_admissao as string,
          status:              'ativo' as const,
          periodo_experiencia,
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
    mudanca_funcao:   { campo: 'funcao_id',    antes: (dadosAntes.funcao_id  as string | null) ?? func?.funcao_id ?? null, depois: (dadosDepois.funcao_destino_id as string) ?? null },
    promocao:         { campo: 'funcao_id',    antes: (dadosAntes.funcao_id  as string | null) ?? func?.funcao_id ?? null, depois: (dadosDepois.funcao_destino_id as string) ?? null },
    alteracao_salario:   { campo: 'salario',      antes: String(func?.salario ?? ''),      depois: String(dadosDepois.novo_salario ?? '') },
    afastamento:         { campo: 'status',       antes: func?.status ?? null,            depois: 'afastado'   },
    retorno_afastamento: { campo: 'status',       antes: func?.status ?? null,            depois: 'ativo'      },
    rescisao_indireta:   { campo: 'status',       antes: func?.status ?? null,            depois: 'desligado'  },
  }
  const mov = campoMap[sol.tipo as keyof typeof campoMap]

  const { error: errMovAprov } = await supabase.from('movimentacoes').insert({
    funcionario_id:  funcionarioId,
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

  const { data: sol } = await supabase
    .from('solicitacoes')
    .select('funcionario_id, tipo')
    .eq('id', id)
    .single()

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

  if (sol?.funcionario_id) {
    await supabase.from('movimentacoes').insert({
      funcionario_id: sol.funcionario_id,
      tipo:           'rejeicao',
      campo_alterado: 'solicitacao',
      valor_antes:    sol.tipo,
      valor_depois:   `rejeitado: ${motivo}`,
      executado_por:  guard.userId,
      solicitacao_id: id,
    })
  }

  revalidatePath('/aprovacoes')
  return { success: true }
}
