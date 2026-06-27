'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'
import type { FaltaTipo } from '@/components/faltas/faltas-config'
import { logSupervisorAcao } from '@/lib/log-supervisor'

export type { FaltaTipo }

export interface FaltaCompleta {
  id: string
  funcionario_id: string
  data_falta: string
  data_fim: string | null
  tipo: FaltaTipo
  dias: number
  observacao: string | null
  registrado_por: string
  created_at: string
  funcionarios: {
    nome: string
    funcoes: { nome: string } | null
    postos: { nome: string; secretaria: string | null } | null
  } | null
  perfis: { nome: string | null } | null
}

export interface AtestadoResumo {
  funcionario_id: string
  nome: string
  secretaria: string | null
  total_dias: number
  total_atestados: number
}

export interface FuncOpt {
  id: string
  nome: string
  postos: { id: string; nome: string; secretaria: string | null } | null
  funcoes: { nome: string } | null
}

export interface DashFaltas {
  total_ocorrencias: number
  total_dias_faltas: number
  total_dias_atestados: number
  total_dias_geral: number
  sem_justificativa: number
  reincidentes: number
  por_secretaria: { secretaria: string; dias_faltas: number; dias_atestados: number; ocorrencias: number }[]
  top_funcionarios: { nome: string; secretaria: string | null; dias: number; ocorrencias: number }[]
  evolucao_mensal: { mes: string; faltas: number; atestados: number }[]
}

const FALTA_SELECT = `
  id, funcionario_id, data_falta, data_fim, tipo, dias, observacao, registrado_por, created_at,
  funcionarios!funcionario_id (
    nome,
    funcoes!funcionarios_funcao_id_fkey ( nome ),
    postos!posto_id ( nome, secretaria )
  ),
  perfis!registrado_por ( nome )
`

export async function buscarFaltas(mes: number, ano: number, tipo?: string): Promise<FaltaCompleta[]> {
  const supabase = createClient()
  const auth = await getUser()
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const fim = new Date(ano, mes, 0)
  const fimStr = `${ano}-${String(mes).padStart(2, '0')}-${String(fim.getDate()).padStart(2, '0')}`

  let query = supabase
    .from('faltas')
    .select(FALTA_SELECT)
    .gte('data_falta', inicio)
    .lte('data_falta', fimStr)
    .order('data_falta', { ascending: false })

  if (auth?.perfil.role === 'supervisor' && auth.user.id) {
    const { data: cfgData } = await supabase
      .from('config_supervisores_postos')
      .select('posto_id')
      .eq('supervisor_id', auth.user.id)
      .eq('ativo', true)
    const postoIds = (cfgData ?? []).map((r: { posto_id: string }) => r.posto_id)
    if (postoIds.length === 0) return []
    const { data: funcs } = await supabase
      .from('funcionarios')
      .select('id')
      .in('posto_id', postoIds)
    const funcIds = (funcs ?? []).map((f: { id: string }) => f.id)
    if (funcIds.length === 0) return []
    query = query.in('funcionario_id', funcIds)
  }

  if (tipo && tipo !== 'todos') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
query = query.eq('tipo', tipo as any)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as FaltaCompleta[]
}

export async function buscarDashFaltas(mes: number, ano: number): Promise<DashFaltas> {
  const supabase = createClient()
  const auth = await getUser()
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const fim = new Date(ano, mes, 0)
  const fimStr = `${ano}-${String(mes).padStart(2, '0')}-${String(fim.getDate()).padStart(2, '0')}`

  let funcIds: string[] | null = null
  if (auth?.perfil.role === 'supervisor') {
    const { data: cfgData } = await supabase
      .from('config_supervisores_postos')
      .select('posto_id')
      .eq('supervisor_id', auth.user.id)
      .eq('ativo', true)
    const postoIds = (cfgData ?? []).map((r: { posto_id: string }) => r.posto_id)
    if (postoIds.length === 0) funcIds = []
    else {
      const { data: funcs } = await supabase.from('funcionarios').select('id').in('posto_id', postoIds)
      funcIds = (funcs ?? []).map((f: { id: string }) => f.id)
    }
  }

  let faltasQuery = supabase
    .from('faltas')
    .select(`id, funcionario_id, tipo, dias, funcionarios!funcionario_id(nome, postos!posto_id(nome, secretaria))`)
    .gte('data_falta', inicio)
    .lte('data_falta', fimStr)
  if (funcIds !== null) {
    if (funcIds.length === 0) faltasQuery = faltasQuery.in('funcionario_id', ['no-match'])
    else faltasQuery = faltasQuery.in('funcionario_id', funcIds)
  }
  const { data: faltas } = await faltasQuery

  let atestadosQuery = supabase
    .from('atestados')
    .select(`id, funcionario_id, data_inicio, data_fim, funcionarios!funcionario_id(nome, postos!posto_id(nome, secretaria))`)
    .gte('data_inicio', inicio)
    .lte('data_inicio', fimStr)
  if (funcIds !== null) {
    if (funcIds.length === 0) atestadosQuery = atestadosQuery.in('funcionario_id', ['no-match'])
    else atestadosQuery = atestadosQuery.in('funcionario_id', funcIds)
  }
  const { data: atestados } = await atestadosQuery

  const totalDiasFaltas = (faltas ?? []).reduce((a, f) => a + (f.dias ?? 1), 0)

  const totalDiasAtestados = (atestados ?? []).reduce((a, at) => {
    if (!at.data_fim) return a + 1
    const d1 = new Date(at.data_inicio)
    const d2 = new Date(at.data_fim)
    return a + Math.ceil((d2.getTime() - d1.getTime()) / 86400000) + 1
  }, 0)

  const semJustificativa = (faltas ?? []).filter(f => f.tipo === 'sem_atestado').length

  const ocorrenciasPorFunc: Record<string, number> = {}
  for (const f of faltas ?? []) {
    ocorrenciasPorFunc[f.funcionario_id] = (ocorrenciasPorFunc[f.funcionario_id] ?? 0) + 1
  }
  for (const a of atestados ?? []) {
    ocorrenciasPorFunc[a.funcionario_id] = (ocorrenciasPorFunc[a.funcionario_id] ?? 0) + 1
  }
  const reincidentes = Object.values(ocorrenciasPorFunc).filter(n => n >= 3).length

  type FuncJoin = { nome: string; postos: { secretaria: string | null } | null } | null

  const secMap: Record<string, { dias_faltas: number; dias_atestados: number; ocorrencias: number }> = {}
  for (const f of faltas ?? []) {
    const func = f.funcionarios as unknown as FuncJoin
    const sec = func?.postos?.secretaria ?? 'Sem Secretaria'
    if (!secMap[sec]) secMap[sec] = { dias_faltas: 0, dias_atestados: 0, ocorrencias: 0 }
    secMap[sec].dias_faltas += f.dias ?? 1
    secMap[sec].ocorrencias += 1
  }
  for (const a of atestados ?? []) {
    const func = a.funcionarios as unknown as FuncJoin
    const sec = func?.postos?.secretaria ?? 'Sem Secretaria'
    if (!secMap[sec]) secMap[sec] = { dias_faltas: 0, dias_atestados: 0, ocorrencias: 0 }
    const d1 = new Date(a.data_inicio)
    const d2 = a.data_fim ? new Date(a.data_fim) : d1
    secMap[sec].dias_atestados += Math.ceil((d2.getTime() - d1.getTime()) / 86400000) + 1
    secMap[sec].ocorrencias += 1
  }
  const por_secretaria = Object.entries(secMap)
    .map(([secretaria, v]) => ({ secretaria, ...v }))
    .sort((a, b) => (b.dias_faltas + b.dias_atestados) - (a.dias_faltas + a.dias_atestados))

  const funcMap: Record<string, { nome: string; secretaria: string | null; dias: number; ocorrencias: number }> = {}
  for (const f of faltas ?? []) {
    const id = f.funcionario_id
    const func = f.funcionarios as unknown as FuncJoin
    const nome = func?.nome ?? ''
    const sec = func?.postos?.secretaria ?? null
    if (!funcMap[id]) funcMap[id] = { nome, secretaria: sec, dias: 0, ocorrencias: 0 }
    funcMap[id].dias += f.dias ?? 1
    funcMap[id].ocorrencias += 1
  }
  for (const a of atestados ?? []) {
    const id = a.funcionario_id
    const func = a.funcionarios as unknown as FuncJoin
    const nome = func?.nome ?? ''
    const sec = func?.postos?.secretaria ?? null
    if (!funcMap[id]) funcMap[id] = { nome, secretaria: sec, dias: 0, ocorrencias: 0 }
    const d1 = new Date(a.data_inicio)
    const d2 = a.data_fim ? new Date(a.data_fim) : d1
    funcMap[id].dias += Math.ceil((d2.getTime() - d1.getTime()) / 86400000) + 1
    funcMap[id].ocorrencias += 1
  }
  const top_funcionarios = Object.values(funcMap)
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 10)

  const evolucao_mensal: { mes: string; faltas: number; atestados: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(ano, mes - 1 - i, 1)
    const m = d.getMonth() + 1
    const y = d.getFullYear()
    const mi = `${y}-${String(m).padStart(2, '0')}-01`
    const mfDate = new Date(y, m, 0)
    const mfStr = `${y}-${String(m).padStart(2, '0')}-${String(mfDate.getDate()).padStart(2, '0')}`
    const label = d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' })

    const { data: mf2 } = await supabase.from('faltas').select('dias').gte('data_falta', mi).lte('data_falta', mfStr)
    const { data: ma } = await supabase.from('atestados').select('data_inicio, data_fim').gte('data_inicio', mi).lte('data_inicio', mfStr)

    const diasF = (mf2 ?? []).reduce((a, f) => a + (f.dias ?? 1), 0)
    const diasA = (ma ?? []).reduce((a, at) => {
      if (!at.data_fim) return a + 1
      const d1 = new Date(at.data_inicio)
      const d2 = new Date(at.data_fim)
      return a + Math.ceil((d2.getTime() - d1.getTime()) / 86400000) + 1
    }, 0)

    evolucao_mensal.push({ mes: label, faltas: diasF, atestados: diasA })
  }

  return {
    total_ocorrencias: (faltas ?? []).length + (atestados ?? []).length,
    total_dias_faltas: totalDiasFaltas,
    total_dias_atestados: totalDiasAtestados,
    total_dias_geral: totalDiasFaltas + totalDiasAtestados,
    sem_justificativa: semJustificativa,
    reincidentes,
    por_secretaria,
    top_funcionarios,
    evolucao_mensal,
  }
}

export async function registrarFalta(fd: FormData) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }

  const funcionario_id = fd.get('funcionario_id') as string
  const data_inicio    = fd.get('data_falta') as string   // campo do form chama data_falta
  const data_fim       = (fd.get('data_fim') as string) || null
  const tipo           = fd.get('tipo') as FaltaTipo
  const observacao     = (fd.get('observacao') as string) || null

  const dias = data_fim && data_fim > data_inicio
    ? Math.ceil((new Date(data_fim).getTime() - new Date(data_inicio).getTime()) / 86400000) + 1
    : 1

  // Pré-verificação de duplicata antes de bater na constraint
  // Usa data_falta (mesmo valor que data_inicio) pois os tipos gerados ainda não incluem data_inicio
  const { data: existing } = await supabase
    .from('faltas')
    .select('id')
    .eq('funcionario_id', funcionario_id)
    .eq('data_falta', data_inicio)
    .maybeSingle()

  if (existing) return { success: false, error: 'DUPLICATE' }

  const adminSupabase = createAdminClient()
  const { error } = await adminSupabase.from('faltas').insert({
    funcionario_id,
    data_falta: data_inicio,
    data_fim:   data_fim || null,
    tipo,
    dias,
    observacao,
    registrado_por: auth.user.id,
  } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

  if (error) {
    const isDupe = error.code === '23505'
      || error.message.includes('duplicate key')
      || error.message.includes('faltas_funcionario_id_data_inicio_key')
    if (isDupe) return { success: false, error: 'DUPLICATE' }
    return { success: false, error: error.message }
  }

  // Falta com 3 ou mais dias → marca funcionário como atestado
  if (dias >= 3) {
    await supabase
      .from('funcionarios')
      .update({ status: 'atestado', motivo_afastamento: 'ausencia_temporaria' })
      .eq('id', funcionario_id)
      .eq('status', 'ativo') // só muda se estiver ativo (não sobrescreve férias etc.)
  }

  if (auth.perfil.role === 'supervisor') {
    const { data: func } = await createAdminClient().from('funcionarios').select('nome').eq('id', funcionario_id).single()
    await logSupervisorAcao({ supervisorId: auth.user.id, tipo: 'falta', acao: 'criou', funcionarioNome: (func as any)?.nome ?? null, detalhes: tipo }) // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  revalidatePath('/faltas')
  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function editarFalta(
  id: string,
  data: { data_falta: string; data_fim: string | null; tipo: FaltaTipo; observacao: string | null }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  const auth = await getUser()
  const dias = data.data_fim && data.data_fim > data.data_falta
    ? Math.ceil((new Date(data.data_fim).getTime() - new Date(data.data_falta).getTime()) / 86400000) + 1
    : 1

  const { data: faltaExist } = await supabase.from('faltas').select('funcionario_id, funcionarios!funcionario_id(nome)').eq('id', id).single()

  const { error } = await supabase.from('faltas').update({
    data_falta: data.data_falta,
    data_fim:   data.data_fim,
    tipo:       data.tipo,
    dias,
    observacao: data.observacao,
  } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .eq('id', id)
  if (error) return { success: false, error: error.message }

  if (auth?.perfil.role === 'supervisor') {
    const nomeFuncionario = (faltaExist as any)?.funcionarios?.nome ?? null // eslint-disable-line @typescript-eslint/no-explicit-any
    await logSupervisorAcao({ supervisorId: auth.user.id, tipo: 'falta', acao: 'editou', funcionarioNome: nomeFuncionario, detalhes: data.tipo })
  }

  revalidatePath('/faltas')
  return { success: true }
}

export async function removerFalta(id: string) {
  const supabase = createClient()
  const auth = await getUser()
  const { data: falta } = await supabase.from('faltas').select('funcionario_id, funcionarios!funcionario_id(nome)').eq('id', id).single()
  const { error } = await supabase.from('faltas').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  if (auth?.perfil.role === 'supervisor') {
    const nomeFuncionario = (falta as any)?.funcionarios?.nome ?? null // eslint-disable-line @typescript-eslint/no-explicit-any
    await logSupervisorAcao({ supervisorId: auth.user.id, tipo: 'falta', acao: 'excluiu', funcionarioNome: nomeFuncionario })
  }

  revalidatePath('/faltas')
  return { success: true }
}

export async function buscarFuncionariosParaFalta(): Promise<FuncOpt[]> {
  const supabase = createClient()
  const auth = await getUser()

  let query = supabase
    .from('funcionarios')
    .select(`id, nome, postos!posto_id(id, nome, secretaria), funcoes!funcionarios_funcao_id_fkey(nome)`)
    .neq('status', 'desligado')
    .order('nome')

  if (auth?.perfil.role === 'supervisor') {
    const { data: cfgData } = await supabase
      .from('config_supervisores_postos')
      .select('posto_id')
      .eq('supervisor_id', auth.user.id)
      .eq('ativo', true)
    const postoIds = (cfgData ?? []).map((r: { posto_id: string }) => r.posto_id)
    if (postoIds.length === 0) return []
    query = query.in('posto_id', postoIds)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as FuncOpt[]
}

export async function criarFalta(fd: FormData): Promise<void> {
  const result = await registrarFalta(fd)
  if (!result.success) throw new Error(result.error)
}
