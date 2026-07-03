'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'

// ─── execução direta ──────────────────────────────────────────────────────────

export async function registrarAtestado(formData: FormData) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')

  const funcionarioId     = formData.get('funcionario_id') as string
  const postoId           = formData.get('posto_id') as string
  const dataInicio        = formData.get('data_inicio') as string
  const dataFim           = formData.get('data_fim') as string
  const motivo            = (formData.get('motivo') as string) || null
  const cidCodigo         = (formData.get('cid_codigo') as string) || null
  const semCid            = formData.get('sem_cid') === 'true'
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
    sem_cid: semCid,
    origem_ocupacional: origemOcupacional,
    registrado_por: auth.user.id,
  })
  if (errAtestado) throw new Error(errAtestado.message)

  // Só altera status se o atestado ainda está vigente (data_fim >= hoje)
  const hoje = new Date().toISOString().slice(0, 10)
  const atestadoVigente = !dataFim || dataFim >= hoje

  if (atestadoVigente) {
    const { error: errStatus } = await supabase
      .from('funcionarios')
      .update({ status: 'atestado', motivo_afastamento: 'ausencia_temporaria' })
      .eq('id', funcionarioId)
    if (errStatus) throw new Error(errStatus.message)

    const { error: errMov } = await supabase.from('movimentacoes').insert({
      funcionario_id: funcionarioId,
      tipo: 'atestado',
      campo_alterado: 'status',
      valor_antes: func?.status ?? null,
      valor_depois: 'atestado',
      executado_por: auth.user.id,
    })
    if (errMov) throw new Error(errMov.message)
  }

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
  const novaFuncaoId   = (formData.get('nova_funcao_id') as string) || null

  const { data: func } = await supabase
    .from('funcionarios')
    .select('posto_id')
    .eq('id', funcionarioId)
    .single()

  const postoOrigemId = func?.posto_id ?? null

  // Usar admin client para buscar nomes de postos (supervisor pode não ter acesso ao posto destino via RLS)
  const adminDb = createAdminClient() as unknown as typeof supabase
  const [{ data: postoDestino }, postoOrigemResult, novaFuncaoResult] = await Promise.all([
    adminDb.from('postos').select('nome').eq('id', postoDestinoId).single(),
    postoOrigemId
      ? adminDb.from('postos').select('nome').eq('id', postoOrigemId).single()
      : Promise.resolve({ data: null }),
    novaFuncaoId
      ? adminDb.from('funcoes').select('nome').eq('id', novaFuncaoId).single()
      : Promise.resolve({ data: null }),
  ])

  const postoOrigemNome  = (postoOrigemResult as { data: { nome: string } | null }).data?.nome ?? null
  const postoDestinoNome = (postoDestino as { nome: string } | null)?.nome ?? null
  const novaFuncaoNome   = (novaFuncaoResult as { data: { nome: string } | null }).data?.nome ?? null

  const { error } = await supabase.from('solicitacoes').insert({
    tipo: 'transferencia',
    status: 'pendente',
    funcionario_id: funcionarioId,
    supervisor_id: auth.user.id,
    dados_antes: { posto_id: postoOrigemId, posto_nome: postoOrigemNome },
    dados_depois: {
      posto_destino_id: postoDestinoId,
      posto_destino_nome: postoDestinoNome,
      motivo,
      ...(novaFuncaoId ? { nova_funcao_id: novaFuncaoId, nova_funcao_nome: novaFuncaoNome } : {}),
    },
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

const MOTIVOS_MEDICOS_INSS = ['INSS - Doença', 'INSS - Acidente de Trabalho']

function addDaysToDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return dt.toISOString().slice(0, 10)
}

export async function solicitarAfastamento(fd: FormData): Promise<ActionResult> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }
  const funcionario_id        = fd.get('funcionario_id') as string
  const motivo                = fd.get('motivo') as string
  const data_inicio           = fd.get('data_inicio') as string
  const diasStr               = (fd.get('dias') as string) || ''
  const ehMedico              = fd.get('eh_medico') === 'true'
  let   data_retorno_prevista = (fd.get('data_retorno_prevista') as string) || null

  // Calcular retorno a partir dos dias se não foi informado manualmente
  if (!data_retorno_prevista && diasStr) {
    const n = parseInt(diasStr)
    if (n > 0 && data_inicio) data_retorno_prevista = addDaysToDate(data_inicio, n)
  }

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status, posto_id')
    .eq('id', funcionario_id)
    .single()

  const { error } = await supabase.from('solicitacoes').insert({
    funcionario_id,
    tipo:          'afastamento' as unknown as 'desligamento',
    status:        'pendente',
    supervisor_id: auth.user.id,
    dados_antes:   { status: func?.status ?? null, posto_id: func?.posto_id ?? null },
    dados_depois:  { motivo, data_inicio, data_retorno_prevista, dias: diasStr || null },
    motivo,
  })
  if (error) return { success: false, error: error.message }

  // Para motivos INSS, registrar atestado imediatamente (sem esperar aprovação)
  if (ehMedico && MOTIVOS_MEDICOS_INSS.includes(motivo) && diasStr && func?.posto_id) {
    const n = parseInt(diasStr)
    if (n > 0) {
      const data_fim = addDaysToDate(data_inicio, n - 1)
      await supabase.from('atestados').insert({
        funcionario_id,
        posto_id:        func.posto_id,
        data_inicio,
        data_fim,
        motivo,
        cid_codigo:      null,
        sem_cid:         false,
        origem_ocupacional: motivo === 'INSS - Acidente de Trabalho' ? 'acidente_trabalho' : null,
        registrado_por:  auth.user.id,
      })
    }
  }

  revalidatePath('/efetivo')
  revalidatePath('/aprovacoes')
  revalidatePath('/atestados')
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
    registro?: string | null
    funcao_id: string
    posto_id: string
    data_admissao: string | null
    status: 'ativo' | 'atestado' | 'afastado' | 'ferias' | 'desligado'
    data_desligamento: string | null
    motivo_desligamento: string | null
    tipo_desligamento: string | null
    periodo_experiencia?: '30+30' | '45+45' | null
  },
): Promise<ActionResult> {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'admin') {
    return { success: false, error: 'Acesso negado' }
  }

  const supabase = createClient()

  const periodoExperiencia = campos.periodo_experiencia ?? null

  const updatePayload: Record<string, unknown> = {
    nome:                campos.nome,
    registro:            campos.registro?.trim() || null,
    funcao_id:           campos.funcao_id || null,
    posto_id:            campos.posto_id || null,
    data_admissao:       campos.data_admissao || null,
    status:              campos.status,
    data_desligamento:   campos.status === 'ativo' ? null : campos.data_desligamento || null,
    motivo_desligamento: campos.status === 'ativo' ? null : campos.motivo_desligamento || null,
    tipo_desligamento:   campos.status === 'ativo' ? null : campos.tipo_desligamento || null,
    periodo_experiencia: periodoExperiencia,
  }

  // Lê estado atual para comparar e logar apenas o que mudou
  const { data: antes } = await supabase
    .from('funcionarios')
    .select('nome, funcao_id, posto_id, status, periodo_experiencia')
    .eq('id', id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from('funcionarios').update(updatePayload as any).eq('id', id)

  if (error) return { success: false, error: error.message }

  // Registra em movimentacoes cada campo que de fato mudou
  if (antes) {
    const camposAuditoria: Array<{ campo: string; antes: string | null; depois: string | null }> = [
      { campo: 'nome',       antes: antes.nome ?? null,               depois: campos.nome || null },
      { campo: 'funcao_id',  antes: antes.funcao_id ?? null,          depois: campos.funcao_id || null },
      { campo: 'posto_id',   antes: antes.posto_id ?? null,           depois: campos.posto_id || null },
      { campo: 'status',     antes: antes.status ?? null,             depois: campos.status || null },
    ]
    const alterados = camposAuditoria.filter(c => c.antes !== c.depois)
    if (alterados.length > 0) {
      await supabase.from('movimentacoes').insert(
        alterados.map(c => ({
          funcionario_id: id,
          tipo:           'edicao_direta',
          campo_alterado: c.campo,
          valor_antes:    c.antes,
          valor_depois:   c.depois,
          executado_por:  auth.user.id,
        }))
      )
    }
  }

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

  const nome               = (formData.get('nome') as string)?.trim().toUpperCase()
  const funcao_id          = formData.get('funcao_id') as string
  const posto_id           = formData.get('posto_id') as string
  const data_admissao      = formData.get('data_admissao') as string
  const registro           = (formData.get('registro') as string)?.trim() || null
  const cpf                = (formData.get('cpf') as string)?.trim() || null
  const periodoRaw         = (formData.get('periodo_experiencia') as string) || ''
  const periodo_experiencia = (periodoRaw === '30+30' || periodoRaw === '45+45') ? periodoRaw : '45+45'

  if (!nome || !funcao_id || !posto_id || !data_admissao) {
    return { error: 'Nome, função, posto e data de admissão são obrigatórios' }
  }

  const payload: Record<string, unknown> = {
    nome, funcao_id, posto_id, data_admissao, status: 'ativo',
    periodo_experiencia: periodoRaw === '' ? null : periodo_experiencia,
  }
  if (registro) payload.registro = registro
  if (cpf) payload.cpf = cpf

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from('funcionarios').insert(payload as any)

  if (error) return { error: error.message }
  revalidatePath('/efetivo')
  return {}
}

export async function marcarRetornoFaltante(funcionarioId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }

  const { error } = await supabase
    .from('funcionarios')
    .update({ status: 'ativo', motivo_afastamento: null })
    .eq('id', funcionarioId)
    .eq('status', 'faltante')

  if (error) return { success: false, error: error.message }

  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function excluirFuncionarioCompleto(id: string): Promise<{ success: boolean; error?: string }> {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'admin') return { success: false, error: 'Acesso negado' }

  const admin = createAdminClient()

  // Deletar em ordem de FK (mais dependentes primeiro)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = admin as any
  await adm.from('faltas').delete().eq('funcionario_id', id)
  await adm.from('advertencias').delete().eq('funcionario_id', id)
  await adm.from('atestados').delete().eq('funcionario_id', id)
  await adm.from('afastamentos').delete().eq('funcionario_id', id)
  await adm.from('coberturas_insalubres').delete().eq('funcionario_id', id)
  await adm.from('coberturas_temporarias').delete().eq('funcionario_ausente_id', id)
  await adm.from('ferias').delete().eq('funcionario_id', id)
  await adm.from('transferencias').delete().eq('funcionario_id', id)
  await adm.from('movimentacoes').delete().eq('funcionario_id', id)
  // historico_funcionarios tem CASCADE, deletado automaticamente com funcionarios
  const { error } = await adm.from('funcionarios').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
  return { success: true }
}
