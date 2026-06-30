'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type FeriasListaItem = {
  id: string
  funcionario_id: string
  funcionario_nome: string
  funcionario_registro: string
  funcionario_status: string | null
  posto_nome: string
  secretaria: string
  supervisor_nome: string
  numero_periodo: number | null
  periodo_inicio: string | null
  periodo_fim: string | null
  limite_gozo: string | null
  dias_direito: number | null
  data_inicio: string | null
  data_fim: string | null
  dias_utilizados: number | null
  status: string
}

export type SupervisorFiltro = {
  nome: string
}

// Alias para compatibilidade com page.tsx
export type SupervisorOpcao = SupervisorFiltro

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

// ─── Mutações ─────────────────────────────────────────────────────────────────

export async function registrarFerias(formData: FormData) {
  const adminSupabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insert: any = {
    funcionario_id: formData.get('funcionario_id') as string,
    data_inicio: formData.get('data_inicio') as string,
    data_fim: formData.get('data_fim') as string,
    observacao: formData.get('observacao') as string || null,
    status: 'agendado',
  }
  const { error } = await adminSupabase.from('ferias').insert(insert)

  if (error) throw new Error(error.message)
  revalidatePath('/ferias')
  return { ok: true }
}

export async function agendarFerias(data: {
  funcionario_id: string
  numero_periodo: number
  periodo_inicio: string
  periodo_fim: string
  limite_gozo: string
  dias_direito: number
  data_inicio: string | null
  data_fim: string | null
  observacao?: string
}) {
  const supabase = createClient()
  const adminSupabase = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const dias_utilizados = data.data_inicio && data.data_fim
    ? Math.ceil((new Date(data.data_fim).getTime() - new Date(data.data_inicio).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    funcionario_id: data.funcionario_id,
    numero_periodo: data.numero_periodo,
    periodo_inicio: data.periodo_inicio,
    periodo_fim: data.periodo_fim,
    limite_gozo: data.limite_gozo,
    dias_direito: data.dias_direito,
    data_inicio: data.data_inicio,
    data_fim: data.data_fim,
    dias_utilizados,
    observacao: data.observacao,
    status: 'agendado',
    criado_por: user.id,
  }
  const { error } = await adminSupabase.from('ferias').insert(payload)

  if (error) throw new Error(error.message)
  revalidatePath('/ferias')
  return { ok: true }
}

export async function aprovarFerias(id: string) {
  const supabase = createClient()
  const adminSupabase = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = { status: 'aprovado', aprovado_por: user.id, aprovado_em: new Date().toISOString() }
  const { error } = await adminSupabase.from('ferias').update(update).eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/ferias')
  revalidatePath('/aprovacoes')
  return { ok: true }
}

export async function iniciarFerias(id: string) {
  const adminSupabase = createAdminClient()

  const { data: fer, error: fetchErr } = await adminSupabase
    .from('ferias').select('funcionario_id').eq('id', id).single()
  if (fetchErr) throw new Error(fetchErr.message)

  const { error } = await adminSupabase.from('ferias').update({ status: 'em_curso' }).eq('id', id)
  if (error) throw new Error(error.message)

  await adminSupabase.from('funcionarios').update({ status: 'ferias' }).eq('id', fer.funcionario_id)

  revalidatePath('/ferias')
  revalidatePath('/postos')
  return { ok: true }
}

export async function concluirFerias(id: string) {
  const adminSupabase = createAdminClient()

  const { data: fer, error: fetchErr } = await adminSupabase
    .from('ferias').select('funcionario_id').eq('id', id).single()
  if (fetchErr) throw new Error(fetchErr.message)

  const { error } = await adminSupabase.from('ferias').update({ status: 'concluido' }).eq('id', id)
  if (error) throw new Error(error.message)

  await adminSupabase.from('funcionarios').update({ status: 'ativo' }).eq('id', fer.funcionario_id)

  revalidatePath('/ferias')
  revalidatePath('/postos')
  return { ok: true }
}

export async function cancelarFerias(id: string, motivo?: string) {
  const adminSupabase = createAdminClient()

  const { data: fer, error: fetchErr } = await adminSupabase
    .from('ferias').select('funcionario_id').eq('id', id).single()
  if (fetchErr) throw new Error(fetchErr.message)

  const { error } = await adminSupabase.from('ferias').update({ status: 'cancelado', observacao: motivo }).eq('id', id)
  if (error) throw new Error(error.message)

  await adminSupabase.from('funcionarios').update({ status: 'ativo' }).eq('id', fer.funcionario_id)

  revalidatePath('/ferias')
  revalidatePath('/postos')
  return { ok: true }
}

// ─── Queries auxiliares ───────────────────────────────────────────────────────

export async function buscarFuncionarioParaFerias(nome: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('funcionarios')
    .select('id, nome, cpf, status, postos!posto_id(nome, secretaria)')
    .ilike('nome', `%${nome}%`)
    .eq('status', 'ativo')
    .limit(10)

  if (error) throw new Error(error.message)
  return data
}

export async function buscarPeriodosAquisitivos(funcionario_id: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('ferias')
    .select('id, numero_periodo, periodo_inicio, periodo_fim, limite_gozo, dias_direito, data_inicio, data_fim, status, dias_utilizados')
    .eq('funcionario_id', funcionario_id)
    .order('numero_periodo', { ascending: true })

  if (error) throw new Error(error.message)
  return data
}

// ─── Buscar lista principal de férias ─────────────────────────────────────────

export async function buscarFeriasLista(): Promise<FeriasListaItem[]> {
  const supabase = createClient()

  // Etapa 1 — dados principais
  const { data, error } = await supabase
    .from('ferias')
    .select(`
      id,
      funcionario_id,
      numero_periodo,
      periodo_inicio,
      periodo_fim,
      limite_gozo,
      dias_direito,
      data_inicio,
      data_fim,
      dias_utilizados,
      status,
      funcionarios (
        id,
        nome,
        registro,
        status,
        posto_id,
        postos ( id, nome, secretaria )
      )
    `)
    .order('funcionarios(nome)', { ascending: true })

  if (error) {
    console.error('Erro ao buscar férias lista:', error)
    return []
  }

  // Coleta posto_ids únicos
  const postoIds = Array.from(new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data ?? []).map((r: any) => r.funcionarios?.postos?.id).filter(Boolean)
  ))

  // Etapa 2 — supervisor por posto
  const mapaPostoSup = new Map<string, string>()
  if (postoIds.length > 0) {
    const { data: cspData } = await supabase
      .from('config_supervisores_postos')
      .select(`
        posto_id,
        perfis!config_supervisores_postos_supervisor_id_fkey ( id, nome )
      `)
      .in('posto_id', postoIds)
      .eq('ativo', true)

    for (const csp of cspData ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const perfil = (csp as any).perfis
      if (perfil?.nome) mapaPostoSup.set(csp.posto_id, perfil.nome)
    }
  }

  // Monta resultado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => {
    const func = r.funcionarios
    const posto = func?.postos
    const postoId = posto?.id ?? ''
    const supervisorNome = mapaPostoSup.get(postoId) ?? '—'

    // Calcula limite_gozo se não vier do banco (período_fim + 10 meses)
    let limiteGozo = r.limite_gozo ?? null
    if (!limiteGozo && r.periodo_fim) {
      limiteGozo = addMonths(r.periodo_fim, 10)
    }

    return {
      id: r.id,
      funcionario_id: r.funcionario_id,
      funcionario_nome: func?.nome ?? '—',
      funcionario_registro: func?.registro ?? '—',
      funcionario_status: func?.status ?? null,
      posto_nome: posto?.nome ?? '—',
      secretaria: posto?.secretaria ?? '—',
      supervisor_nome: supervisorNome,
      numero_periodo: r.numero_periodo,
      periodo_inicio: r.periodo_inicio,
      periodo_fim: r.periodo_fim,
      limite_gozo: limiteGozo,
      dias_direito: r.dias_direito,
      data_inicio: r.data_inicio,
      data_fim: r.data_fim,
      dias_utilizados: r.dias_utilizados,
      status: r.status,
    }
  })
}

// ─── Buscar supervisores para filtro ─────────────────────────────────────────

export async function importarFeriasHistoricas(data: {
  funcionario_id: string
  numero_periodo: number
  periodo_inicio: string
  periodo_fim: string
  limite_gozo: string | null
  dias_direito: number
  data_inicio: string
  data_fim: string
  dias_utilizados?: number
  observacao?: string
}) {
  const adminSupabase = createAdminClient()
  const { error } = await adminSupabase.from('ferias').insert({
    funcionario_id: data.funcionario_id,
    numero_periodo: data.numero_periodo,
    periodo_inicio: data.periodo_inicio,
    periodo_fim: data.periodo_fim,
    limite_gozo: data.limite_gozo,
    dias_direito: data.dias_direito,
    data_inicio: data.data_inicio,
    data_fim: data.data_fim,
    dias_utilizados: data.dias_utilizados ?? null,
    status: 'concluido',
    observacao: data.observacao ?? null,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/ferias')
}

export async function editarFerias(id: string, data: {
  data_inicio: string | null
  data_fim: string | null
  dias_utilizados: number | null
  status: string
  observacao?: string | null
}) {
  const adminSupabase = createAdminClient()

  const { data: fer, error: fetchErr } = await adminSupabase
    .from('ferias').select('funcionario_id').eq('id', id).single()
  if (fetchErr) throw new Error(fetchErr.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    data_inicio: data.data_inicio,
    data_fim: data.data_fim,
    dias_utilizados: data.dias_utilizados,
    status: data.status,
    observacao: data.observacao ?? null,
  }
  const { error } = await adminSupabase.from('ferias').update(payload).eq('id', id)
  if (error) throw new Error(error.message)

  // Sincroniza status do funcionário
  if (data.status === 'em_curso') {
    await adminSupabase.from('funcionarios').update({ status: 'ferias' }).eq('id', fer.funcionario_id)
  } else if (['concluido', 'cancelado', 'agendado', 'aprovado'].includes(data.status)) {
    await adminSupabase.from('funcionarios').update({ status: 'ativo' }).eq('id', fer.funcionario_id)
  }

  revalidatePath('/ferias')
  revalidatePath('/postos')
  return { ok: true }
}

export async function excluirFerias(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('ferias')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/ferias')
  return { ok: true }
}

export async function buscarSupervisoresParaFiltro(): Promise<SupervisorFiltro[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('config_supervisores_postos')
    .select(`
      perfis!config_supervisores_postos_supervisor_id_fkey ( nome )
    `)
    .eq('ativo', true)

  if (error) {
    console.error('Erro ao buscar supervisores:', error)
    return []
  }

  const nomes = Array.from(new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data ?? []).map((d: any) => d.perfis?.nome).filter(Boolean)
  )).sort() as string[]

  return nomes.map(nome => ({ nome }))
}
