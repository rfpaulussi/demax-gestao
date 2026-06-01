'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'

// ─── execução direta ──────────────────────────────────────────────────────────

export async function registrarAtestado(formData: FormData) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')

  const funcionarioId = formData.get('funcionario_id') as string
  const postoId       = formData.get('posto_id') as string
  const dataInicio    = formData.get('data_inicio') as string
  const dataFim       = formData.get('data_fim') as string
  const motivo        = (formData.get('motivo') as string) || null

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status')
    .eq('id', funcionarioId)
    .single()

  await Promise.all([
    supabase.from('atestados').insert({
      funcionario_id: funcionarioId,
      posto_id: postoId,
      data_inicio: dataInicio,
      data_fim: dataFim,
      motivo,
      registrado_por: auth.user.id,
    }),
    supabase
      .from('funcionarios')
      .update({ status: 'afastado' })
      .eq('id', funcionarioId),
    supabase.from('movimentacoes').insert({
      funcionario_id: funcionarioId,
      tipo: 'atestado',
      campo_alterado: 'status',
      valor_antes: func?.status ?? null,
      valor_depois: 'afastado',
      executado_por: auth.user.id,
    }),
  ])

  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
}

export async function registrarFerias(formData: FormData) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')

  const funcionarioId = formData.get('funcionario_id') as string
  const dataInicio    = formData.get('data_inicio') as string
  const dataFim       = formData.get('data_fim') as string
  const observacao    = (formData.get('observacao') as string) || null

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status')
    .eq('id', funcionarioId)
    .single()

  await Promise.all([
    supabase.from('ferias').insert({
      funcionario_id: funcionarioId,
      data_inicio: dataInicio,
      data_fim: dataFim,
      observacao,
      status: 'agendada',
    }),
    supabase
      .from('funcionarios')
      .update({ status: 'ferias' })
      .eq('id', funcionarioId),
    supabase.from('movimentacoes').insert({
      funcionario_id: funcionarioId,
      tipo: 'ferias',
      campo_alterado: 'status',
      valor_antes: func?.status ?? null,
      valor_depois: 'ferias',
      executado_por: auth.user.id,
    }),
  ])

  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
}

export async function afastarFuncionario(formData: FormData) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')

  const funcionarioId = formData.get('funcionario_id') as string

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status')
    .eq('id', funcionarioId)
    .single()

  await Promise.all([
    supabase
      .from('funcionarios')
      .update({ status: 'afastado' })
      .eq('id', funcionarioId),
    supabase.from('movimentacoes').insert({
      funcionario_id: funcionarioId,
      tipo: 'afastamento',
      campo_alterado: 'status',
      valor_antes: func?.status ?? null,
      valor_depois: 'afastado',
      executado_por: auth.user.id,
    }),
  ])

  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
}

// ─── solicitações (requerem aprovação do admin) ───────────────────────────────

export async function solicitarDesligamento(formData: FormData) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')

  const funcionarioId    = formData.get('funcionario_id') as string
  const dataDesligamento = formData.get('data_desligamento') as string
  const motivo           = formData.get('motivo') as string

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status, posto_id, funcao_id')
    .eq('id', funcionarioId)
    .single()

  await supabase.from('solicitacoes').insert({
    tipo: 'desligamento',
    status: 'pendente',
    funcionario_id: funcionarioId,
    supervisor_id: auth.user.id,
    dados_antes: {
      status: func?.status ?? null,
      posto_id: func?.posto_id ?? null,
      funcao_id: func?.funcao_id ?? null,
    },
    dados_depois: { data_desligamento: dataDesligamento, motivo },
    motivo,
  })

  revalidatePath('/efetivo')
  revalidatePath('/aprovacoes')
}

export async function solicitarTransferencia(formData: FormData) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')

  const funcionarioId  = formData.get('funcionario_id') as string
  const postoDestinoId = formData.get('posto_destino_id') as string
  const motivo         = (formData.get('motivo') as string) || null

  const { data: func } = await supabase
    .from('funcionarios')
    .select('posto_id')
    .eq('id', funcionarioId)
    .single()

  const postoOrigemId = func?.posto_id ?? null

  const [{ data: postoDestino }, postoOrigemResult] = await Promise.all([
    supabase.from('postos').select('nome').eq('id', postoDestinoId).single(),
    postoOrigemId
      ? supabase.from('postos').select('nome').eq('id', postoOrigemId).single()
      : Promise.resolve({ data: null }),
  ])

  const postoOrigemNome  = (postoOrigemResult as { data: { nome: string } | null }).data?.nome ?? null
  const postoDestinoNome = postoDestino?.nome ?? null

  await supabase.from('solicitacoes').insert({
    tipo: 'transferencia',
    status: 'pendente',
    funcionario_id: funcionarioId,
    supervisor_id: auth.user.id,
    dados_antes: { posto_id: postoOrigemId, posto_nome: postoOrigemNome },
    dados_depois: { posto_destino_id: postoDestinoId, posto_destino_nome: postoDestinoNome, motivo },
    motivo,
  })

  revalidatePath('/efetivo')
  revalidatePath('/aprovacoes')
}

export async function solicitarMudancaFuncao(formData: FormData) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')

  const funcionarioId   = formData.get('funcionario_id') as string
  const funcaoDestinoId = formData.get('funcao_destino_id') as string
  const motivo          = (formData.get('motivo') as string) || null

  const { data: func } = await supabase
    .from('funcionarios')
    .select('funcao_id')
    .eq('id', funcionarioId)
    .single()

  const funcaoOrigemId = func?.funcao_id ?? null

  const [{ data: funcaoDestino }, funcaoOrigemResult] = await Promise.all([
    supabase.from('funcoes').select('nome').eq('id', funcaoDestinoId).single(),
    funcaoOrigemId
      ? supabase.from('funcoes').select('nome').eq('id', funcaoOrigemId).single()
      : Promise.resolve({ data: null }),
  ])

  const funcaoOrigemNome  = (funcaoOrigemResult as { data: { nome: string } | null }).data?.nome ?? null
  const funcaoDestinoNome = funcaoDestino?.nome ?? null

  await supabase.from('solicitacoes').insert({
    tipo: 'mudanca_funcao',
    status: 'pendente',
    funcionario_id: funcionarioId,
    supervisor_id: auth.user.id,
    dados_antes: { funcao_id: funcaoOrigemId, funcao_nome: funcaoOrigemNome },
    dados_depois: { funcao_destino_id: funcaoDestinoId, funcao_destino_nome: funcaoDestinoNome, motivo },
    motivo,
  })

  revalidatePath('/efetivo')
  revalidatePath('/aprovacoes')
}

export async function solicitarPromocao(formData: FormData) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')

  const funcionarioId   = formData.get('funcionario_id') as string
  const funcaoDestinoId = formData.get('funcao_destino_id') as string
  const motivo          = (formData.get('motivo') as string) || null

  const { data: func } = await supabase
    .from('funcionarios')
    .select('funcao_id')
    .eq('id', funcionarioId)
    .single()

  const funcaoOrigemId = func?.funcao_id ?? null

  const [{ data: funcaoDestino }, funcaoOrigemResult] = await Promise.all([
    supabase.from('funcoes').select('nome').eq('id', funcaoDestinoId).single(),
    funcaoOrigemId
      ? supabase.from('funcoes').select('nome').eq('id', funcaoOrigemId).single()
      : Promise.resolve({ data: null }),
  ])

  const funcaoOrigemNome  = (funcaoOrigemResult as { data: { nome: string } | null }).data?.nome ?? null
  const funcaoDestinoNome = funcaoDestino?.nome ?? null

  await supabase.from('solicitacoes').insert({
    tipo: 'promocao',
    status: 'pendente',
    funcionario_id: funcionarioId,
    supervisor_id: auth.user.id,
    dados_antes: { funcao_id: funcaoOrigemId, funcao_nome: funcaoOrigemNome },
    dados_depois: { funcao_destino_id: funcaoDestinoId, funcao_destino_nome: funcaoDestinoNome, motivo },
    motivo,
  })

  revalidatePath('/efetivo')
  revalidatePath('/aprovacoes')
}

export async function solicitarMudancaSupervisor(formData: FormData) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')

  const funcionarioId    = formData.get('funcionario_id') as string
  const novoSupervisorId = formData.get('novo_supervisor_id') as string
  const motivo           = (formData.get('motivo') as string) || null

  const { data: func } = await supabase
    .from('funcionarios')
    .select('posto_id')
    .eq('id', funcionarioId)
    .single()

  const postoId = func?.posto_id ?? null

  let supervisorAtualId: string | null = null
  let supervisorAtualNome: string | null = null
  if (postoId) {
    const { data: cfg } = await supabase
      .from('config_supervisores_postos')
      .select('supervisor_id, perfis!supervisor_id(nome)')
      .eq('posto_id', postoId)
      .eq('ativo', true)
      .limit(1)
      .single()
    supervisorAtualId   = cfg?.supervisor_id ?? null
    supervisorAtualNome = (cfg as unknown as { perfis?: { nome: string | null } } | null)?.perfis?.nome ?? null
  }

  const { data: novoSup } = await supabase
    .from('perfis')
    .select('nome')
    .eq('id', novoSupervisorId)
    .single()

  await supabase.from('solicitacoes').insert({
    tipo: 'mudanca_supervisor',
    status: 'pendente',
    funcionario_id: funcionarioId,
    supervisor_id: auth.user.id,
    dados_antes: { supervisor_id: supervisorAtualId, supervisor_nome: supervisorAtualNome },
    dados_depois: { novo_supervisor_id: novoSupervisorId, novo_supervisor_nome: novoSup?.nome ?? null, motivo },
    motivo,
  })

  revalidatePath('/efetivo')
  revalidatePath('/aprovacoes')
}
