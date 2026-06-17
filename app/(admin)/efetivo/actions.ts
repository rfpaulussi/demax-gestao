'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'

// ─── execução direta ──────────────────────────────────────────────────────────

export async function registrarAtestado(formData: FormData) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')

  const funcionarioId      = formData.get('funcionario_id') as string
  const postoId            = formData.get('posto_id') as string
  const dataInicio         = formData.get('data_inicio') as string
  const dataFim            = formData.get('data_fim') as string
  const motivo             = (formData.get('motivo') as string) || null
  const cidCodigo          = (formData.get('cid_codigo') as string) || null
  const origemOcupacional = ((formData.get('origem_ocupacional') as string) || null) as 'acidente_trabalho' | 'doenca_ocupacional' | null

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status')
    .eq('id', funcionarioId)
    .single()

  const { error: errAtestado } = await supabase.from('atestados').insert({
    funcionario_id: funcionarioId,
    posto_id: postoId,
    data_inicio: dataInicio,
    data_fim: dataFim,
    motivo,
    cid_codigo: cidCodigo,
    origem_ocupacional: origemOcupacional,
    registrado_por: auth.user.id,
  })
  if (errAtestado) throw new Error(errAtestado.message)

  const { error: errStatus } = await supabase
    .from('funcionarios')
    .update({ status: 'afastado' })
    .eq('id', funcionarioId)
  if (errStatus) throw new Error(errStatus.message)

  const { error: errMov } = await supabase.from('movimentacoes').insert({
    funcionario_id: funcionarioId,
    tipo: 'atestado',
    campo_alterado: 'status',
    valor_antes: func?.status ?? null,
    valor_depois: 'afastado',
    executado_por: auth.user.id,
  })
  if (errMov) throw new Error(errMov.message)

  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
  revalidatePath('/faltas')
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

  const [, , { error: errMovFerias }] = await Promise.all([
    supabase.from('ferias').insert({
      funcionario_id: funcionarioId,
      data_inicio: dataInicio,
      data_fim: dataFim,
      observacao,
      status: 'agendado',
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
  if (errMovFerias) console.error('[movimentacoes] registrarFerias:', errMovFerias.message)

  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
}

// ─── solicitações (requerem aprovação do admin) ───────────────────────────────

type ActionResult = { success: true } | { success: false; error: string }

export async function solicitarDesligamento(formData: FormData): Promise<ActionResult> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }

  const funcionarioId    = formData.get('funcionario_id') as string
  const dataDesligamento = formData.get('data_desligamento') as string
  const motivo           = formData.get('motivo') as string

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status, posto_id, funcao_id')
    .eq('id', funcionarioId)
    .single()

  const { error } = await supabase.from('solicitacoes').insert({
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

  if (error) return { success: false, error: error.message }

  revalidatePath('/efetivo')
  revalidatePath('/aprovacoes')
  return { success: true }
}

export async function solicitarTransferencia(formData: FormData): Promise<ActionResult> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }

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

  const { error } = await supabase.from('solicitacoes').insert({
    tipo: 'transferencia',
    status: 'pendente',
    funcionario_id: funcionarioId,
    supervisor_id: auth.user.id,
    dados_antes: { posto_id: postoOrigemId, posto_nome: postoOrigemNome },
    dados_depois: { posto_destino_id: postoDestinoId, posto_destino_nome: postoDestinoNome, motivo },
    motivo,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/efetivo')
  revalidatePath('/aprovacoes')
  return { success: true }
}

export async function solicitarMudancaFuncao(formData: FormData): Promise<ActionResult> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }

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

  const { error } = await supabase.from('solicitacoes').insert({
    tipo: 'mudanca_funcao',
    status: 'pendente',
    funcionario_id: funcionarioId,
    supervisor_id: auth.user.id,
    dados_antes: { funcao_id: funcaoOrigemId, funcao_nome: funcaoOrigemNome },
    dados_depois: { funcao_destino_id: funcaoDestinoId, funcao_destino_nome: funcaoDestinoNome, motivo },
    motivo,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/efetivo')
  revalidatePath('/aprovacoes')
  return { success: true }
}

export async function solicitarAfastamento(fd: FormData): Promise<ActionResult> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }
  const funcionario_id       = fd.get('funcionario_id') as string
  const motivo               = fd.get('motivo') as string
  const data_inicio          = fd.get('data_inicio') as string
  const data_retorno_prevista = (fd.get('data_retorno_prevista') as string) || null

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status, posto_id')
    .eq('id', funcionario_id)
    .single()

  const { error } = await supabase.from('solicitacoes').insert({
    funcionario_id,
    tipo:         'afastamento' as unknown as 'desligamento',
    status:       'pendente',
    supervisor_id: auth.user.id,
    dados_antes:  { status: func?.status ?? null, posto_id: func?.posto_id ?? null },
    dados_depois: { motivo, data_inicio, data_retorno_prevista },
    motivo,
  })
  if (error) return { success: false, error: error.message }
  revalidatePath('/efetivo')
  revalidatePath('/aprovacoes')
  return { success: true }
}

export async function solicitarRetornoAfastamento(fd: FormData): Promise<ActionResult> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }
  const funcionario_id  = fd.get('funcionario_id') as string
  const data_retorno    = fd.get('data_retorno') as string
  const posto_retorno_id = (fd.get('posto_retorno_id') as string) || null

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status, posto_id, postos!posto_id(nome)')
    .eq('id', funcionario_id)
    .single()

  const funcTyped = func as unknown as {
    status: string | null
    posto_id: string | null
    postos: { nome: string } | null
  } | null

  const { error } = await supabase.from('solicitacoes').insert({
    funcionario_id,
    tipo:         'retorno_afastamento' as unknown as 'desligamento',
    status:       'pendente',
    supervisor_id: auth.user.id,
    dados_antes:  {
      status:    funcTyped?.status ?? null,
      posto_id:  funcTyped?.posto_id ?? null,
      posto_nome: funcTyped?.postos?.nome ?? null,
    },
    dados_depois: { data_retorno, posto_retorno_id },
  })
  if (error) return { success: false, error: error.message }
  revalidatePath('/efetivo')
  revalidatePath('/aprovacoes')
  return { success: true }
}

export async function solicitarRescisaoIndireta(fd: FormData): Promise<ActionResult> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }
  const funcionario_id = fd.get('funcionario_id') as string
  const motivo         = fd.get('motivo') as string
  const data_rescisao  = fd.get('data_rescisao') as string

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status, posto_id, funcao_id')
    .eq('id', funcionario_id)
    .single()

  const { error } = await supabase.from('solicitacoes').insert({
    funcionario_id,
    tipo:         'rescisao_indireta' as unknown as 'desligamento',
    status:       'pendente',
    supervisor_id: auth.user.id,
    dados_antes:  { status: func?.status ?? null, posto_id: func?.posto_id ?? null, funcao_id: func?.funcao_id ?? null },
    dados_depois: { motivo, data_rescisao },
    motivo,
  })
  if (error) return { success: false, error: error.message }
  revalidatePath('/efetivo')
  revalidatePath('/aprovacoes')
  return { success: true }
}

export async function editarFuncionario(
  id: string,
  campos: {
    nome: string
    funcao_id: string
    posto_id: string
    data_admissao: string | null
    status: 'ativo' | 'afastado' | 'ferias' | 'desligado'
    data_desligamento: string | null
    motivo_desligamento: string | null
    tipo_desligamento: string | null
    periodo_experiencia?: '30+30' | '45+45' | null
    fase_experiencia?: '1' | '2' | 'concluido' | null
    data_fim_fase1?: string | null
    data_fim_fase2?: string | null
  },
): Promise<ActionResult> {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'admin') {
    return { success: false, error: 'Acesso negado' }
  }

  const supabase = createClient()

  const updatePayload: Record<string, unknown> = {
    nome:                campos.nome,
    funcao_id:           campos.funcao_id || null,
    posto_id:            campos.posto_id || null,
    data_admissao:       campos.data_admissao || null,
    status:              campos.status,
    data_desligamento:   campos.status === 'ativo' ? null : campos.data_desligamento || null,
    motivo_desligamento: campos.status === 'ativo' ? null : campos.motivo_desligamento || null,
    tipo_desligamento:   campos.status === 'ativo' ? null : campos.tipo_desligamento || null,
    periodo_experiencia: campos.periodo_experiencia ?? null,
    fase_experiencia:    campos.periodo_experiencia ? (campos.fase_experiencia ?? null) : null,
    data_fim_fase1:      campos.periodo_experiencia ? (campos.data_fim_fase1 ?? null) : null,
    data_fim_fase2:      campos.periodo_experiencia ? (campos.data_fim_fase2 ?? null) : null,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from('funcionarios').update(updatePayload as any).eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/efetivo')
  revalidatePath(`/efetivo/${id}`)
  revalidatePath('/dashboard')

  return { success: true }
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

export async function admitirFuncionarioAdmin(formData: FormData): Promise<{ error?: string }> {
  const supabase = createClient()

  const nome          = (formData.get('nome') as string)?.trim().toUpperCase()
  const funcao_id     = formData.get('funcao_id') as string
  const posto_id      = formData.get('posto_id') as string
  const data_admissao = formData.get('data_admissao') as string
  const registro      = (formData.get('registro') as string)?.trim() || null
  const cpf           = (formData.get('cpf') as string)?.trim() || null

  if (!nome || !funcao_id || !posto_id || !data_admissao) {
    return { error: 'Nome, função, posto e data de admissão são obrigatórios' }
  }

  const payload: Record<string, unknown> = { nome, funcao_id, posto_id, data_admissao, status: 'ativo' }
  if (registro) payload.registro = registro
  if (cpf) payload.cpf = cpf

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from('funcionarios').insert(payload as any)

  if (error) return { error: error.message }
  revalidatePath('/efetivo')
  return {}
}

export async function renovarFaseExperiencia(funcionarioId: string): Promise<ActionResult> {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'admin') return { success: false, error: 'Acesso negado' }

  const supabase = createClient()
  const { data } = await supabase
    .from('funcionarios')
    .select('fase_experiencia, periodo_experiencia, data_fim_fase1')
    .eq('id', funcionarioId)
    .single()

  if (!data || data.fase_experiencia !== '1') {
    return { success: false, error: 'Funcionário não está na fase 1 de experiência' }
  }
  if (!data.data_fim_fase1) {
    return { success: false, error: 'Data fim da fase 1 não definida' }
  }

  const base = new Date(data.data_fim_fase1 + 'T00:00:00')
  const days = data.periodo_experiencia === '30+30' ? 30 : 45
  base.setDate(base.getDate() + days)
  const data_fim_fase2 = base.toISOString().split('T')[0]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from('funcionarios').update({ fase_experiencia: '2', data_fim_fase2 } as any).eq('id', funcionarioId)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/efetivo/${funcionarioId}`)
  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function encerrarExperiencia(funcionarioId: string): Promise<ActionResult> {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'admin') return { success: false, error: 'Acesso negado' }

  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from('funcionarios').update({ fase_experiencia: 'concluido' } as any).eq('id', funcionarioId)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/efetivo/${funcionarioId}`)
  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
  return { success: true }
}
