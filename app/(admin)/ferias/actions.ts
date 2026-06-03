'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function registrarFerias(formData: FormData) {
  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insert: any = {
    funcionario_id: formData.get('funcionario_id') as string,
    data_inicio: formData.get('data_inicio') as string,
    data_fim: formData.get('data_fim') as string,
    observacao: formData.get('observacao') as string || null,
    status: 'agendado',
  }
  const { error } = await supabase.from('ferias').insert(insert)

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
  data_inicio: string
  data_fim: string
  observacao?: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const dias_utilizados = Math.ceil(
    (new Date(data.data_fim).getTime() - new Date(data.data_inicio).getTime())
    / (1000 * 60 * 60 * 24)
  ) + 1

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
  const { error } = await supabase.from('ferias').insert(payload)

  if (error) throw new Error(error.message)
  revalidatePath('/ferias')
  return { ok: true }
}

export async function aprovarFerias(id: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = { status: 'aprovado', aprovado_por: user.id, aprovado_em: new Date().toISOString() }
  const { error } = await supabase.from('ferias').update(update).eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/ferias')
  revalidatePath('/aprovacoes')
  return { ok: true }
}

export async function concluirFerias(id: string) {
  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const concludeUpdate: any = { status: 'concluido' }
  const { error } = await supabase.from('ferias').update(concludeUpdate).eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/ferias')
  return { ok: true }
}

export async function cancelarFerias(id: string, motivo?: string) {
  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cancelUpdate: any = { status: 'cancelado', observacao: motivo }
  const { error } = await supabase.from('ferias').update(cancelUpdate).eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/ferias')
  return { ok: true }
}

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

// ─── Nova: lista de férias com supervisor ─────────────────────────────────────

export interface FeriasListaItem {
  id: string
  funcionario_id: string
  funcionario_nome: string
  registro: string
  cargo: string
  posto_nome: string
  secretaria: string
  posto_id: string | null
  supervisor_nome: string
  numero_periodo: number
  data_inicio: string | null
  data_fim: string | null
  dias_direito: number
  dias_utilizados: number | null
  status: string
  observacao: string | null
  aprovado_em: string | null
}

export interface SupervisorOpcao {
  id: string
  nome: string
}

export async function buscarSupervisoresParaFiltro(): Promise<SupervisorOpcao[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('config_supervisores_postos')
    .select(`
      supervisor_id,
      perfis!config_supervisores_postos_supervisor_id_fkey ( id, nome )
    `)
    .eq('ativo', true)

  if (error || !data) return []

  const mapa = new Map<string, string>()
  for (const row of data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const perfil = row.perfis as any
    if (perfil?.id && perfil?.nome) mapa.set(perfil.id, perfil.nome)
  }

  return Array.from(mapa.entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

export async function buscarFeriasLista(): Promise<FeriasListaItem[]> {
  const supabase = createClient()

  // Etapa 1 — férias com funcionário, posto e função
  const { data, error } = await supabase
    .from('ferias')
    .select(`
      id,
      funcionario_id,
      numero_periodo,
      data_inicio,
      data_fim,
      dias_direito,
      dias_utilizados,
      status,
      observacao,
      aprovado_em,
      funcionarios (
        id,
        nome,
        registro,
        posto_id,
        funcoes ( nome ),
        postos ( id, nome, secretaria )
      )
    `)
    .order('data_inicio', { ascending: false })

  if (error || !data) return []

  // Coleta posto_ids únicos
  const postoIdsSet = new Set<string>()
  for (const r of data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const id = (r.funcionarios as any)?.postos?.id
    if (id) postoIdsSet.add(id)
  }
  const postoIds = Array.from(postoIdsSet)

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
      const perfil = csp.perfis as any
      if (perfil?.nome) mapaPostoSup.set(csp.posto_id, perfil.nome)
    }
  }

  return data.map(row => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const func   = row.funcionarios as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const posto  = func?.postos as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const funcao = func?.funcoes as any

    return {
      id:               row.id,
      funcionario_id:   row.funcionario_id,
      funcionario_nome: func?.nome ?? '—',
      registro:         func?.registro ?? '—',
      cargo:            funcao?.nome ?? '—',
      posto_nome:       posto?.nome ?? '—',
      secretaria:       posto?.secretaria ?? '—',
      posto_id:         posto?.id ?? null,
      supervisor_nome:  posto?.id ? (mapaPostoSup.get(posto.id) ?? 'Sem supervisor') : 'Sem supervisor',
      numero_periodo:   row.numero_periodo ?? 1,
      data_inicio:      row.data_inicio,
      data_fim:         row.data_fim,
      dias_direito:     row.dias_direito ?? 30,
      dias_utilizados:  row.dias_utilizados,
      status:           row.status ?? 'disponivel',
      observacao:       row.observacao,
      aprovado_em:      row.aprovado_em,
    }
  })
}
