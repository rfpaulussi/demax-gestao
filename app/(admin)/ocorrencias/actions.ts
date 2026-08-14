'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'
import { FALTA_TIPO_LABELS, type FaltaTipo } from '@/components/faltas/faltas-config'

type ActionResult = { success: true } | { success: false; error: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }

// ─── labels locais (mesmo padrão de duplicação já usado em advertencias/actions.ts) ──

const GRAU_LABEL: Record<string, string> = {
  verbal: 'Verbal', escrita: 'Escrita', suspensao: 'Suspensão',
}

const NATUREZA_LABEL: Record<string, string> = {
  comportamento:   'Comportamento Inadequado',
  falta:           'Falta Injustificada',
  atraso:          'Atraso Recorrente',
  negligencia:     'Negligência no Trabalho',
  descumprimento:  'Descumprimento de Normas',
  insubordinacao:  'Insubordinação',
  'desídia':       'Desídia',
  improbidade:     'Improbidade',
  ofensa_honra:    'Ofensa à Honra',
  ofensa_superior: 'Ofensa ao Empregador/Superior',
  uso_indevido:    'Uso Indevido de Equipamentos',
  embriaguez:      'Embriaguez em Serviço',
  abandono:        'Abandono de Posto',
  outro:           'Outro',
}

function diffDias(inicio: string, fim: string | null): number {
  if (!fim) return 1
  const d1 = new Date(inicio + 'T00:00:00')
  const d2 = new Date(fim + 'T00:00:00')
  return Math.ceil((d2.getTime() - d1.getTime()) / 86400000) + 1
}

async function getPostoIdsSupervisor(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('config_supervisores_postos')
    .select('posto_id')
    .eq('supervisor_id', userId)
    .eq('ativo', true)
  return (data ?? []).map((r: { posto_id: string }) => r.posto_id)
}

// ─── busca de funcionário ─────────────────────────────────────────────────────

export type FuncionarioBusca = {
  id: string
  nome: string
  cpf: string | null
  registro: string | null
  posto_nome: string
  secretaria: string
}

type RawFuncBusca = {
  id: string
  nome: string
  cpf: string | null
  registro: string | null
  postos: { nome: string; secretaria: string | null } | null
}

export async function getFuncionariosParaBusca(): Promise<FuncionarioBusca[]> {
  const supabase = createClient()
  const auth = await getUser()

  let query = supabase
    .from('funcionarios')
    .select('id, nome, cpf, registro, postos!posto_id(nome, secretaria)')
    .neq('status', 'desligado')
    .order('nome')

  if (auth?.perfil.role === 'supervisor') {
    const postoIds = await getPostoIdsSupervisor(supabase, auth.user.id)
    if (postoIds.length === 0) return []
    query = query.in('posto_id', postoIds)
  }

  const { data } = await query
  return ((data ?? []) as unknown as RawFuncBusca[]).map(f => ({
    id: f.id,
    nome: f.nome,
    cpf: f.cpf,
    registro: f.registro,
    posto_nome: f.postos?.nome ?? '—',
    secretaria: f.postos?.secretaria ?? '',
  }))
}

// ─── supervisores (usado no form de nova ocorrência) ──────────────────────────

export type SupervisorSimples = { id: string; nome: string }

export async function getSupervisoresSimples(): Promise<SupervisorSimples[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('perfis')
    .select('id, nome')
    .eq('role', 'supervisor')
    .eq('ativo', true)
    .order('nome')
  return (data ?? []).map(p => ({ id: p.id, nome: p.nome ?? '' }))
}

// ─── alertas (lembretes pessoais do supervisor, sem funcionário) ─────────────

export type AlertaRow = {
  id: string
  titulo: string | null
  descricao: string
  data_lembrete: string | null
  created_at: string
  supervisor_nome: string | null
}

export async function getAlertas(): Promise<AlertaRow[]> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return []

  let query = (supabase as unknown as AnyClient)
    .from('ocorrencias')
    .select('id, titulo, descricao, data_lembrete, created_at, supervisor_id')
    .eq('tipo', 'alerta')
    .eq('status', 'aberta')
    .order('created_at', { ascending: false })

  if (auth.perfil.role === 'supervisor') {
    query = query.eq('supervisor_id', auth.user.id)
  }

  const { data } = await query
  type RawAlerta = { id: string; titulo: string | null; descricao: string; data_lembrete: string | null; created_at: string; supervisor_id: string | null }
  const rows = (data ?? []) as RawAlerta[]

  const supervisorIds = Array.from(new Set(rows.map(a => a.supervisor_id).filter((s): s is string => Boolean(s))))
  const perfisMap = new Map<string, string>()
  if (supervisorIds.length > 0) {
    const { data: perfis } = await supabase.from('perfis').select('id, nome').in('id', supervisorIds)
    for (const p of perfis ?? []) if (p.nome) perfisMap.set(p.id, p.nome)
  }

  return rows.map(a => ({
    id: a.id,
    titulo: a.titulo,
    descricao: a.descricao,
    data_lembrete: a.data_lembrete,
    created_at: a.created_at,
    supervisor_nome: a.supervisor_id ? (perfisMap.get(a.supervisor_id) ?? null) : null,
  }))
}

export async function criarAlerta(
  titulo: string,
  descricao: string,
  data_lembrete: string | null,
): Promise<ActionResult> {
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }
  if (auth.perfil.role === 'viewer') return { success: false, error: 'Sem permissão' }

  const adminSupabase = createAdminClient()

  const { error } = await (adminSupabase as unknown as AnyClient).from('ocorrencias').insert({
    supervisor_id:   auth.user.id,
    titulo,
    descricao,
    data_ocorrencia: new Date().toISOString().split('T')[0],
    data_lembrete:   data_lembrete || null,
    gravidade:       'baixa',
    status:          'aberta',
    tipo:            'alerta',
    criado_por:      auth.user.id,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/ocorrencias')
  return { success: true }
}

export async function resolverAlerta(id: string): Promise<ActionResult> {
  const auth = await getUser()
  if (!auth || auth.perfil.role === 'viewer') return { success: false, error: 'Sem permissão' }

  const adminSupabase = createAdminClient()

  if (auth.perfil.role === 'supervisor') {
    const { data: alerta } = await (adminSupabase as unknown as AnyClient)
      .from('ocorrencias')
      .select('supervisor_id')
      .eq('id', id)
      .single()
    if (alerta?.supervisor_id !== auth.user.id) return { success: false, error: 'Sem permissão' }
  }

  const { error } = await (adminSupabase as unknown as AnyClient)
    .from('ocorrencias')
    .update({ status: 'resolvido', atualizado_por: auth.user.id, atualizado_em: new Date().toISOString() })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/ocorrencias')
  return { success: true }
}

// ─── dossiê do funcionário ─────────────────────────────────────────────────────

export type TimelineTipo = 'advertencia' | 'atestado' | 'falta' | 'ocorrencia'

export type TimelineItem = {
  id: string
  tipo: TimelineTipo
  data: string
  titulo: string
  detalhe: string
  gravidade?: 'baixa' | 'media' | 'alta' | 'critica' | null
  status?: string | null
}

export type DossieFuncionario = {
  funcionario: {
    id: string
    nome: string
    cpf: string | null
    registro: string | null
    posto_nome: string
    secretaria: string
  }
  kpis: {
    advertencias: number
    diasAtestado12m: number
    faltas: number
    ocorrenciasAbertas: number
  }
  timeline: TimelineItem[]
}

type RawOcorrenciaDossie = {
  id: string
  titulo: string | null
  descricao: string | null
  data_ocorrencia: string | null
  gravidade: string | null
  status: string | null
}

export async function getDossieFuncionario(funcionarioId: string): Promise<DossieFuncionario | null> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return null

  if (auth.perfil.role === 'supervisor') {
    const postoIds = await getPostoIdsSupervisor(supabase, auth.user.id)
    const { data: func } = await supabase.from('funcionarios').select('posto_id').eq('id', funcionarioId).single()
    if (!func?.posto_id || !postoIds.includes(func.posto_id)) return null
  }

  const { data: funcRaw } = await supabase
    .from('funcionarios')
    .select('id, nome, cpf, registro, postos!posto_id(nome, secretaria)')
    .eq('id', funcionarioId)
    .single()
  if (!funcRaw) return null
  const func = funcRaw as unknown as {
    id: string; nome: string; cpf: string | null; registro: string | null
    postos: { nome: string; secretaria: string | null } | null
  }

  const umAnoAtras = new Date()
  umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1)
  const umAnoAtrasStr = umAnoAtras.toISOString().split('T')[0]

  const [
    { data: advertencias },
    { data: atestados },
    { data: faltas },
    { data: ocorrenciasRaw },
  ] = await Promise.all([
    supabase.from('advertencias')
      .select('id, grau, natureza, descricao, data_ocorrencia')
      .eq('funcionario_id', funcionarioId),
    supabase.from('atestados')
      .select('id, data_inicio, data_fim, motivo')
      .eq('funcionario_id', funcionarioId),
    supabase.from('faltas')
      .select('id, data_falta, tipo, dias, observacao')
      .eq('funcionario_id', funcionarioId),
    (supabase as unknown as AnyClient).from('ocorrencias')
      .select('id, titulo, descricao, data_ocorrencia, gravidade, status')
      .eq('funcionario_id', funcionarioId)
      .eq('tipo', 'ocorrencia'),
  ])

  const ocorrencias = (ocorrenciasRaw ?? []) as RawOcorrenciaDossie[]
  const timeline: TimelineItem[] = []

  for (const a of advertencias ?? []) {
    timeline.push({
      id: `advertencia-${a.id}`,
      tipo: 'advertencia',
      data: a.data_ocorrencia ?? '',
      titulo: `Advertência ${GRAU_LABEL[a.grau ?? ''] ?? a.grau ?? ''}`,
      detalhe: a.natureza ? (NATUREZA_LABEL[a.natureza] ?? a.natureza) : (a.descricao ?? '—'),
    })
  }

  for (const at of atestados ?? []) {
    timeline.push({
      id: `atestado-${at.id}`,
      tipo: 'atestado',
      data: at.data_inicio,
      titulo: `Atestado (${diffDias(at.data_inicio, at.data_fim)}d)`,
      detalhe: at.motivo ?? '—',
    })
  }

  for (const f of faltas ?? []) {
    timeline.push({
      id: `falta-${f.id}`,
      tipo: 'falta',
      data: f.data_falta,
      titulo: `Falta — ${FALTA_TIPO_LABELS[f.tipo as FaltaTipo] ?? f.tipo}`,
      detalhe: f.observacao ?? `${f.dias} dia(s)`,
    })
  }

  for (const o of ocorrencias) {
    timeline.push({
      id: `ocorrencia-${o.id}`,
      tipo: 'ocorrencia',
      data: o.data_ocorrencia ?? '',
      titulo: o.titulo ?? 'Ocorrência',
      detalhe: o.descricao ?? '—',
      gravidade: (o.gravidade ?? 'baixa') as TimelineItem['gravidade'],
      status: o.status ?? 'aberta',
    })
  }

  timeline.sort((a, b) => b.data.localeCompare(a.data))

  const diasAtestado12m = (atestados ?? [])
    .filter(at => at.data_inicio >= umAnoAtrasStr)
    .reduce((sum, at) => sum + diffDias(at.data_inicio, at.data_fim), 0)

  return {
    funcionario: {
      id: func.id,
      nome: func.nome,
      cpf: func.cpf,
      registro: func.registro,
      posto_nome: func.postos?.nome ?? '—',
      secretaria: func.postos?.secretaria ?? '',
    },
    kpis: {
      advertencias: (advertencias ?? []).length,
      diasAtestado12m,
      faltas: (faltas ?? []).length,
      ocorrenciasAbertas: ocorrencias.filter(o => o.status === 'aberta' || o.status === 'em_analise').length,
    },
    timeline,
  }
}

export async function createOcorrencia(formData: FormData): Promise<ActionResult> {
  const auth = await getUser()
  if (!auth || auth.perfil.role === 'viewer') return { success: false, error: 'Sem permissão' }

  const supabase = createClient()
  const adminSupabase = createAdminClient()

  const funcionario_id  = formData.get('funcionario_id') as string
  const supervisor_id   = (formData.get('supervisor_id') as string) || null
  const descricao       = formData.get('descricao') as string
  const data_ocorrencia = formData.get('data_ocorrencia') as string
  const gravidade       = formData.get('gravidade') as string

  if (!funcionario_id) return { success: false, error: 'Funcionário obrigatório' }

  const { data: func } = await supabase.from('funcionarios').select('posto_id').eq('id', funcionario_id).single()
  if (!func?.posto_id) return { success: false, error: 'Funcionário sem posto vinculado' }

  if (auth.perfil.role === 'supervisor') {
    const postoIds = await getPostoIdsSupervisor(supabase, auth.user.id)
    if (!postoIds.includes(func.posto_id)) return { success: false, error: 'Funcionário fora da sua área' }
  }

  const { error } = await (adminSupabase as unknown as AnyClient).from('ocorrencias').insert({
    funcionario_id,
    posto_id: func.posto_id,
    supervisor_id,
    descricao,
    data_ocorrencia,
    gravidade,
    status: 'aberta',
    tipo: 'ocorrencia',
    criado_por: auth.user.id,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/ocorrencias')
  return { success: true }
}

export async function updateStatusOcorrencia(formData: FormData): Promise<ActionResult> {
  const auth = await getUser()
  if (!auth || auth.perfil.role === 'viewer') return { success: false, error: 'Sem permissão' }

  const supabase = createClient()
  const adminSupabase = createAdminClient()

  const id     = formData.get('id') as string
  const status = formData.get('status') as string

  if (auth.perfil.role === 'supervisor') {
    const { data: ocorrencia } = await (adminSupabase as unknown as AnyClient)
      .from('ocorrencias')
      .select('posto_id')
      .eq('id', id)
      .single()
    const postoIds = await getPostoIdsSupervisor(supabase, auth.user.id)
    if (!ocorrencia?.posto_id || !postoIds.includes(ocorrencia.posto_id)) {
      return { success: false, error: 'Sem permissão' }
    }
  }

  const { error } = await (adminSupabase as unknown as AnyClient)
    .from('ocorrencias')
    .update({ status, atualizado_por: auth.user.id, atualizado_em: new Date().toISOString() })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/ocorrencias')
  return { success: true }
}
