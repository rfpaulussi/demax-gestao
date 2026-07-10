'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { feriadosDoAno, diasUteisNoPeriodo, toDate } from '@/lib/utils/dias-uteis'

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
  observacao: string | null
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

  let dias_utilizados: number | null = null
  if (data.data_inicio && data.data_fim) {
    const { data: func } = await supabase
      .from('funcionarios')
      .select('posto_id')
      .eq('id', data.funcionario_id)
      .single()
    let regime = '5x2'
    if (func?.posto_id) {
      const { data: escala } = await supabase
        .from('config_escalas_postos')
        .select('regime')
        .eq('posto_id', func.posto_id)
        .maybeSingle()
      if (escala?.regime) regime = escala.regime
    }
    const ano = new Date(data.data_inicio).getFullYear()
    dias_utilizados = diasUteisNoPeriodo(toDate(data.data_inicio), toDate(data.data_fim), regime, feriadosDoAno(ano))
  }

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
      observacao,
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
      observacao: r.observacao ?? null,
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

  // Notifica admins/coordenadores quando supervisor agenda férias (sino interno)
  if (data.status === 'agendado' && data.data_inicio && data.data_fim) {
    try {
      const { data: ferDetalhes } = await adminSupabase
        .from('ferias')
        .select(`numero_periodo, dias_direito, funcionarios ( nome, postos ( nome ) )`)
        .eq('id', id)
        .single()
      const supabaseUser = createClient()
      const { data: { user: currentUser } } = await supabaseUser.auth.getUser()
      const { data: perfil } = await supabaseUser
        .from('perfis')
        .select('nome')
        .eq('id', currentUser?.id ?? '')
        .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fd = (ferDetalhes as any)
      const ini = new Date(data.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')
      const fim = new Date(data.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')
      await adminSupabase.from('log_supervisor_acoes').insert({
        supervisor_nome: perfil?.nome ?? 'Supervisor',
        tipo: 'ferias_agendada',
        acao: 'agendou',
        funcionario_nome: fd?.funcionarios?.nome ?? '—',
        detalhes: `${fd?.numero_periodo ?? '?'}º período · ${ini} a ${fim}`,
        lido: false,
      })
    } catch (e) {
      console.error('[ferias] Erro ao registrar notificação de agendamento:', e)
    }
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

// ─── Inconsistências de férias ────────────────────────────────────────────────

export type TipoInconsistencia = 'PA_CURTO' | 'PA_DUPLICADO' | 'PA_INVERTIDO' | 'MULTIPLOS_EM_CURSO'

export type Inconsistencia = {
  tipo: TipoInconsistencia
  funcionario_id: string
  funcionario_nome: string
  funcionario_registro: string
  posto_nome: string
  secretaria: string
  descricao: string
  ferias_ids: string[]
  numero_periodos: number[]
}

export async function buscarInconsistenciasFerias(): Promise<Inconsistencia[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('ferias')
    .select(`
      id, funcionario_id, numero_periodo, periodo_inicio, periodo_fim,
      data_inicio, data_fim, status, dias_direito,
      funcionarios ( nome, registro, postos ( nome, secretaria ) )
    `)
    .not('status', 'eq', 'cancelado')
    .order('funcionario_id')
    .order('numero_periodo')

  if (error) { console.error(error); return [] }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byFunc = new Map<string, any[]>()
  for (const r of (data ?? [])) {
    if (!byFunc.has(r.funcionario_id)) byFunc.set(r.funcionario_id, [])
    byFunc.get(r.funcionario_id)!.push(r)
  }

  const result: Inconsistencia[] = []

  for (const [fid, periodos] of Array.from(byFunc.entries())) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const func  = (periodos[0] as any).funcionarios
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const posto = (func?.postos as any)
    const base  = {
      funcionario_id:       fid,
      funcionario_nome:     func?.nome       ?? '—',
      funcionario_registro: func?.registro   ?? '—',
      posto_nome:           posto?.nome      ?? '—',
      secretaria:           posto?.secretaria ?? '—',
    }

    // Múltiplos em_curso
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emCurso = periodos.filter((p: any) => p.status === 'em_curso')
    if (emCurso.length > 1) {
      result.push({
        ...base, tipo: 'MULTIPLOS_EM_CURSO',
        descricao: `${emCurso.length} períodos com status "Em Curso" ao mesmo tempo`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ferias_ids: emCurso.map((p: any) => p.id),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        numero_periodos: emCurso.map((p: any) => p.numero_periodo).filter(Boolean),
      })
    }

    // PA duplicado (mesmo numero_periodo)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nums = periodos.map((p: any) => p.numero_periodo).filter(Boolean) as number[]
    const dup  = nums.filter((n, i) => nums.indexOf(n) !== i)
    for (const n of Array.from(new Set(dup))) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dupsP = periodos.filter((p: any) => p.numero_periodo === n)
      result.push({
        ...base, tipo: 'PA_DUPLICADO',
        descricao: `${n}º período aquisitivo registrado ${dupsP.length}×`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ferias_ids: dupsP.map((p: any) => p.id),
        numero_periodos: [n],
      })
    }

    // PA curto (< 300 dias) e PA invertido
    for (const p of periodos) {
      if (!p.periodo_inicio || !p.periodo_fim) continue
      const dur = Math.round(
        (new Date(p.periodo_fim + 'T00:00:00').getTime() - new Date(p.periodo_inicio + 'T00:00:00').getTime())
        / 86400000
      )
      if (p.periodo_inicio > p.periodo_fim) {
        result.push({
          ...base, tipo: 'PA_INVERTIDO',
          descricao: `${p.numero_periodo}º PA: início ${p.periodo_inicio} é posterior ao fim ${p.periodo_fim}`,
          ferias_ids: [p.id],
          numero_periodos: [p.numero_periodo].filter(Boolean),
        })
      } else if (dur < 300) {
        result.push({
          ...base, tipo: 'PA_CURTO',
          descricao: `${p.numero_periodo}º PA com apenas ${dur} dias (esperado ~365). Possível confusão entre PA e datas de gozo.`,
          ferias_ids: [p.id],
          numero_periodos: [p.numero_periodo].filter(Boolean),
        })
      }
    }
  }

  return result.sort((a, b) => a.funcionario_nome.localeCompare(b.funcionario_nome, 'pt-BR'))
}

// ─── Saldo de férias por funcionário ─────────────────────────────────────────

export type SaldoFeriasItem = {
  funcionario_id: string
  funcionario_nome: string
  funcionario_registro: string
  posto_nome: string
  secretaria: string
  supervisor_nome: string
  total_dias: number
  periodos_pendentes: number
  limite_mais_proximo: string | null
  tem_vencido: boolean
}

export async function buscarSaldoFeriasAgregado(): Promise<SaldoFeriasItem[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('ferias')
    .select(`
      id, funcionario_id, numero_periodo, dias_direito, limite_gozo, status,
      funcionarios ( nome, registro, postos ( id, nome, secretaria ) )
    `)
    .in('status', ['disponivel', 'agendado', 'aprovado'])

  if (error) { console.error(error); return [] }

  // Coleta posto_ids únicos p/ supervisor
  const postoIds = Array.from(new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data ?? []).map((r: any) => r.funcionarios?.postos?.id).filter(Boolean)
  ))
  const mapaPostoSup = new Map<string, string>()
  if (postoIds.length > 0) {
    const { data: csp } = await supabase
      .from('config_supervisores_postos')
      .select(`posto_id, perfis!config_supervisores_postos_supervisor_id_fkey ( nome )`)
      .in('posto_id', postoIds)
      .eq('ativo', true)
    for (const c of csp ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = (c as any).perfis
      if (p?.nome) mapaPostoSup.set(c.posto_id, p.nome)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byFunc = new Map<string, any[]>()
  for (const r of (data ?? [])) {
    if (!byFunc.has(r.funcionario_id)) byFunc.set(r.funcionario_id, [])
    byFunc.get(r.funcionario_id)!.push(r)
  }

  const result: SaldoFeriasItem[] = []

  for (const [fid, periodos] of Array.from(byFunc.entries())) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const func  = (periodos[0] as any).funcionarios
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const posto = (func?.postos as any)
    const postoId = posto?.id ?? ''

    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const limites = periodos.map((p: any) => p.limite_gozo).filter(Boolean) as string[]
    const limiteMaisProximo = limites.length
      ? limites.sort()[0]
      : null
    const temVencido = limiteMaisProximo
      ? new Date(limiteMaisProximo + 'T00:00:00') < hoje
      : false

    result.push({
      funcionario_id:       fid,
      funcionario_nome:     func?.nome       ?? '—',
      funcionario_registro: func?.registro   ?? '—',
      posto_nome:           posto?.nome      ?? '—',
      secretaria:           posto?.secretaria ?? '—',
      supervisor_nome:      mapaPostoSup.get(postoId) ?? '—',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      total_dias:           periodos.reduce((s: number, p: any) => s + (p.dias_direito ?? 30), 0),
      periodos_pendentes:   periodos.length,
      limite_mais_proximo:  limiteMaisProximo,
      tem_vencido:          temVencido,
    })
  }

  return result.sort((a, b) => {
    // Vencidos primeiro, depois por dias desc
    if (a.tem_vencido !== b.tem_vencido) return a.tem_vencido ? -1 : 1
    return b.total_dias - a.total_dias
  })
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
