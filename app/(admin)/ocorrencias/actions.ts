'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { validarTexto } from '@/lib/ocorrencias/devolutiva'
import { notificarDevolutiva } from '@/lib/ocorrencias/notificar-devolutiva'
import type { AuthUser } from '@/lib/auth/get-user'
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

// ─── painel de funcionários (tabela inicial da tela) ──────────────────────────

export type FuncionarioPainel = {
  id: string
  nome: string
  registro: string | null
  posto_nome: string
  secretaria: string
  supervisor_nomes: string[]
  contagens: {
    advertencias: number
    atestados: number
    faltas: number
    ocorrencias: number
  }
}

type RawFuncPainel = {
  id: string
  nome: string
  registro: string | null
  posto_id: string | null
  postos: { nome: string; secretaria: string | null } | null
}

type RawContagem = { funcionario_id: string }

async function contarPorFuncionario(
  factory: (from: number, to: number) => PromiseLike<{ data: RawContagem[] | null; error: { message: string } | null }>,
): Promise<Map<string, number>> {
  const rows = await fetchAllRows<RawContagem>(factory)
  const map = new Map<string, number>()
  for (const r of rows) {
    map.set(r.funcionario_id, (map.get(r.funcionario_id) ?? 0) + 1)
  }
  return map
}

type RawConfigSupervisor = {
  posto_id: string
  perfis: { nome: string | null } | { nome: string | null }[] | null
}

async function getSupervisoresPorPosto(
  supabase: ReturnType<typeof createClient>,
): Promise<Map<string, string[]>> {
  const { data } = await supabase
    .from('config_supervisores_postos')
    .select('posto_id, perfis(nome)')
    .eq('ativo', true)

  const map = new Map<string, string[]>()
  for (const row of (data ?? []) as unknown as RawConfigSupervisor[]) {
    const perfil = Array.isArray(row.perfis) ? row.perfis[0] : row.perfis
    const nome = perfil?.nome
    if (!nome) continue
    const list = map.get(row.posto_id) ?? []
    list.push(nome)
    map.set(row.posto_id, list)
  }
  return map
}

export async function getPainelFuncionarios(): Promise<FuncionarioPainel[]> {
  const supabase = createClient()
  const auth = await getUser()

  let postoIds: string[] | null = null
  if (auth?.perfil.role === 'supervisor') {
    postoIds = await getPostoIdsSupervisor(supabase, auth.user.id)
    if (postoIds.length === 0) return []
  }

  // fetchAllRows contorna o max_rows do PostgREST (1000) — a base de
  // funcionários já ultrapassa esse limite em outras telas (ver postos/actions.ts).
  const funcionariosRaw = await fetchAllRows<RawFuncPainel>((from, to) => {
    let query = supabase
      .from('funcionarios')
      .select('id, nome, registro, posto_id, postos!posto_id(nome, secretaria)')
      .neq('status', 'desligado')
      .order('nome')
      .range(from, to)
    if (postoIds) query = query.in('posto_id', postoIds)
    return query as unknown as PromiseLike<{ data: RawFuncPainel[] | null; error: { message: string } | null }>
  })

  const [advertenciasMap, atestadosMap, faltasMap, ocorrenciasMap, supervisoresPorPosto] = await Promise.all([
    contarPorFuncionario((from, to) =>
      supabase.from('advertencias').select('funcionario_id').range(from, to) as unknown as PromiseLike<{ data: RawContagem[] | null; error: { message: string } | null }>,
    ),
    contarPorFuncionario((from, to) =>
      supabase.from('atestados').select('funcionario_id').range(from, to) as unknown as PromiseLike<{ data: RawContagem[] | null; error: { message: string } | null }>,
    ),
    contarPorFuncionario((from, to) =>
      supabase.from('faltas').select('funcionario_id').range(from, to) as unknown as PromiseLike<{ data: RawContagem[] | null; error: { message: string } | null }>,
    ),
    contarPorFuncionario((from, to) =>
      (supabase as unknown as AnyClient)
        .from('ocorrencias')
        .select('funcionario_id')
        .eq('tipo', 'ocorrencia')
        .not('funcionario_id', 'is', null)
        .range(from, to) as unknown as PromiseLike<{ data: RawContagem[] | null; error: { message: string } | null }>,
    ),
    getSupervisoresPorPosto(supabase),
  ])

  return funcionariosRaw.map(f => ({
    id: f.id,
    nome: f.nome,
    registro: f.registro,
    posto_nome: f.postos?.nome ?? '—',
    secretaria: f.postos?.secretaria ?? '',
    supervisor_nomes: f.posto_id ? (supervisoresPorPosto.get(f.posto_id) ?? []) : [],
    contagens: {
      advertencias: advertenciasMap.get(f.id) ?? 0,
      atestados: atestadosMap.get(f.id) ?? 0,
      faltas: faltasMap.get(f.id) ?? 0,
      ocorrencias: ocorrenciasMap.get(f.id) ?? 0,
    },
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
  comentarios?: number
  supervisor_nome?: string | null
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
  supervisor_id: string | null
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
      .select('id, titulo, descricao, data_ocorrencia, gravidade, status, supervisor_id')
      .eq('funcionario_id', funcionarioId)
      .eq('tipo', 'ocorrencia'),
  ])

  const ocorrencias = (ocorrenciasRaw ?? []) as RawOcorrenciaDossie[]

  // contagem de mensagens por ocorrência (viewer não vê a conversa, então não recebe contagem)
  const contagemComentarios = new Map<string, number>()
  if (ocorrencias.length > 0 && auth.perfil.role !== 'viewer') {
    const { data: cs } = await (createAdminClient() as unknown as AnyClient)
      .from('ocorrencia_comentarios')
      .select('ocorrencia_id')
      .in('ocorrencia_id', ocorrencias.map(o => o.id))
    for (const c of (cs ?? []) as { ocorrencia_id: string }[]) {
      contagemComentarios.set(c.ocorrencia_id, (contagemComentarios.get(c.ocorrencia_id) ?? 0) + 1)
    }
  }

  const supervisorIds = Array.from(new Set(ocorrencias.map(o => o.supervisor_id).filter((s): s is string => Boolean(s))))
  const supervisorNomesMap = new Map<string, string>()
  if (supervisorIds.length > 0) {
    const { data: perfisSupervisores } = await supabase.from('perfis').select('id, nome').in('id', supervisorIds)
    for (const p of perfisSupervisores ?? []) if (p.nome) supervisorNomesMap.set(p.id, p.nome)
  }

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
      comentarios: contagemComentarios.get(o.id) ?? 0,
      supervisor_nome: o.supervisor_id ? (supervisorNomesMap.get(o.supervisor_id) ?? null) : null,
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

// ─── devolutiva (conversa RH <-> supervisor) ──────────────────────────────────

type OcorrenciaDevolutiva = {
  id: string
  status: string
  posto_id: string | null
  supervisor_id: string | null
  funcionario_id: string
  funcionario_nome: string
}

// Carrega a ocorrência com o admin client e barra supervisor fora do posto dele.
// Devolve null se não existe, não é do tipo 'ocorrencia', não tem funcionário ou o usuário não tem acesso.
async function carregarOcorrenciaDevolutiva(
  ocorrenciaId: string,
  auth: AuthUser,
): Promise<OcorrenciaDevolutiva | null> {
  const { data } = await (createAdminClient() as unknown as AnyClient)
    .from('ocorrencias')
    .select('id, tipo, status, posto_id, supervisor_id, funcionario_id, funcionarios!funcionario_id(nome)')
    .eq('id', ocorrenciaId)
    .single()
  if (!data || data.tipo !== 'ocorrencia' || !data.funcionario_id) return null

  if (auth.perfil.role === 'supervisor') {
    const postoIds = await getPostoIdsSupervisor(createClient(), auth.user.id)
    if (!data.posto_id || !postoIds.includes(data.posto_id)) return null
  }

  const func = Array.isArray(data.funcionarios) ? data.funcionarios[0] : data.funcionarios
  return {
    id: data.id,
    status: data.status ?? 'aberta',
    posto_id: data.posto_id,
    supervisor_id: data.supervisor_id,
    funcionario_id: data.funcionario_id,
    funcionario_nome: func?.nome ?? 'funcionário',
  }
}

export type ComentarioRow = {
  id: string
  texto: string
  tipo: 'mensagem' | 'parecer'
  created_at: string
  autor_nome: string
  autor_role: string
}

type RawComentario = {
  id: string
  texto: string
  tipo: 'mensagem' | 'parecer'
  created_at: string
  perfis: { nome: string | null; role: string | null } | { nome: string | null; role: string | null }[] | null
}

export async function getComentarios(ocorrenciaId: string): Promise<ComentarioRow[]> {
  const auth = await getUser()
  if (!auth || auth.perfil.role === 'viewer') return []

  const oc = await carregarOcorrenciaDevolutiva(ocorrenciaId, auth)
  if (!oc) return []

  // admin client: o RLS de perfis não deixa o supervisor ler o nome do autor do RH.
  // O escopo do supervisor já foi checado em carregarOcorrenciaDevolutiva.
  const { data } = await (createAdminClient() as unknown as AnyClient)
    .from('ocorrencia_comentarios')
    .select('id, texto, tipo, created_at, perfis!autor_id(nome, role)')
    .eq('ocorrencia_id', ocorrenciaId)
    .order('created_at', { ascending: true })

  return ((data ?? []) as RawComentario[]).map(c => {
    const perfil = Array.isArray(c.perfis) ? c.perfis[0] : c.perfis
    return {
      id: c.id,
      texto: c.texto,
      tipo: c.tipo,
      created_at: c.created_at,
      autor_nome: perfil?.nome ?? 'Usuário',
      autor_role: perfil?.role ?? '',
    }
  })
}

export async function comentarOcorrencia(ocorrenciaId: string, texto: string): Promise<ActionResult> {
  const auth = await getUser()
  if (!auth || auth.perfil.role === 'viewer') return { success: false, error: 'Sem permissão' }

  const validado = validarTexto(texto)
  if (!validado.ok) return { success: false, error: validado.error }

  const oc = await carregarOcorrenciaDevolutiva(ocorrenciaId, auth)
  if (!oc) return { success: false, error: 'Sem permissão' }

  const { error } = await (createAdminClient() as unknown as AnyClient)
    .from('ocorrencia_comentarios')
    .insert({
      ocorrencia_id: ocorrenciaId,
      autor_id: auth.user.id,
      texto: validado.texto,
      tipo: 'mensagem',
    })
  if (error) return { success: false, error: error.message }

  await notificarDevolutiva({
    funcionarioId: oc.funcionario_id,
    funcionarioNome: oc.funcionario_nome,
    postoId: oc.posto_id,
    supervisorDaOcorrencia: oc.supervisor_id,
    autorId: auth.user.id,
    autorRole: auth.perfil.role ?? '',
    parecer: false,
  })

  revalidatePath('/ocorrencias')
  return { success: true }
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

  const id         = formData.get('id') as string
  const status     = formData.get('status') as string
  const parecerRaw = (formData.get('parecer') as string | null) ?? ''

  // Só as duas transições que a tela oferece; qualquer outro valor é recusado
  // (senão um status fora da lista pularia a exigência de parecer).
  if (status !== 'em_analise' && status !== 'encerrada') {
    return { success: false, error: 'Status inválido' }
  }

  // Encerrar exige parecer. Ele vira uma mensagem (tipo 'parecer') na conversa.
  let parecer: string | null = null
  if (status === 'encerrada') {
    const validado = validarTexto(parecerRaw)
    if (!validado.ok) return { success: false, error: 'Escreva o parecer para encerrar a ocorrência' }
    parecer = validado.texto
  }

  const oc = await carregarOcorrenciaDevolutiva(id, auth)
  if (!oc) return { success: false, error: 'Sem permissão' }

  // Ocorrência já encerrada não reabre nem recebe um segundo parecer.
  if (oc.status === 'encerrada' || oc.status === 'resolvido') {
    return { success: false, error: 'Esta ocorrência já foi encerrada' }
  }

  const adminSupabase = createAdminClient() as unknown as AnyClient

  // Parecer primeiro: se a gravação falhar o status não muda e o usuário pode tentar de novo.
  if (parecer) {
    const { error: erroParecer } = await adminSupabase.from('ocorrencia_comentarios').insert({
      ocorrencia_id: id,
      autor_id: auth.user.id,
      texto: parecer,
      tipo: 'parecer',
    })
    if (erroParecer) return { success: false, error: erroParecer.message }
  }

  const { error } = await adminSupabase
    .from('ocorrencias')
    .update({ status, atualizado_por: auth.user.id, atualizado_em: new Date().toISOString() })
    .eq('id', id)
  if (error) return { success: false, error: error.message }

  if (parecer) {
    await notificarDevolutiva({
      funcionarioId: oc.funcionario_id,
      funcionarioNome: oc.funcionario_nome,
      postoId: oc.posto_id,
      supervisorDaOcorrencia: oc.supervisor_id,
      autorId: auth.user.id,
      autorRole: auth.perfil.role ?? '',
      parecer: true,
    })
  }

  revalidatePath('/ocorrencias')
  return { success: true }
}
