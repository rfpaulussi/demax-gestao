'use server'

import { revalidatePath } from 'next/cache'
import { getUser } from '@/lib/auth/get-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { addDias, diasEntre, ehData, hojeBR, segundaDe } from '@/lib/agenda/datas'
import { CORES_FOCO, type Periodo } from '@/lib/agenda/tema'
import { postosDoSupervisor, type PostoOpt } from '@/lib/agenda/postos'
import { dataBR, montarVisitas, type BlocoPlan, type CheckinRaw, type PostoGeo } from '@/lib/agenda/visitas'

// As tabelas agenda_* ainda não estão em types/database.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }
const db = () => createAdminClient() as unknown as AnyClient

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Resultado = { ok: true } | { ok: false; erro: string }

export type TipoFoco = { id: string; nome: string; cor: string; icone: string; ativo: boolean; ordem: number }
export type { PostoOpt }

export type BlocoView = {
  id: string
  data: string
  periodo: Periodo
  tipo_foco_id: string
  observacao: string | null
  replanejado: boolean
  motivo_replanejamento: string | null
  postos: { id: string; nome: string }[]
}

export type ComentarioView = {
  id: string
  autor_nome: string
  autor_role: string
  texto: string
  created_at: string
}

export type Sugestao = {
  posto_id: string
  nome: string
  secretaria: string | null
  ultima_data: string | null
  dias: number | null
}

export type AgendaDados = {
  supervisor: { id: string; nome: string }
  semanaInicio: string
  semana: { id: string | null; status: 'rascunho' | 'publicada'; publicada_em: string | null }
  blocos: BlocoView[]
  tipos: TipoFoco[]
  postos: PostoOpt[]
  sugestoes: Sugestao[]
  comentarios: ComentarioView[]
  podeEditar: boolean
  checkinsHoje: CheckinHoje[]
  geoDisponivel: boolean
}

export type CheckinHoje = {
  id: string
  posto_id: string
  tipo: 'entrada' | 'saida'
  created_at: string
  dentro_raio: boolean
  baixa_precisao: boolean
  distancia_m: number | null
}

export type CardSupervisor = {
  id: string
  nome: string
  status: 'sem_agenda' | 'rascunho' | 'publicada'
  slots: Record<string, string> // "data|periodo" -> cor do foco
  blocos: number
  postosDistintos: number
  totalPostos: number
  replanejamentos: number
  comentarios: number
  cumprimento: number | null // % de visitas devidas com check-in; null = sem base
  faltas: number // visitas planejadas já vencidas sem check-in
  foraRaio: number // check-ins fora do raio ou com GPS impreciso
}

const PERIODOS_VALIDOS: Periodo[] = ['manha', 'tarde', 'noite']
const ROTULO_PERIODO: Record<Periodo, string> = { manha: 'manhã', tarde: 'tarde', noite: 'noite' }

function ehGestao(role: string | null | undefined) {
  return role === 'admin' || role === 'coordenador'
}

// ─── Leitura ──────────────────────────────────────────────────────────────────

/** false enquanto a migração 20261011_agenda_semanal.sql não foi aplicada. */
export async function agendaDisponivel(): Promise<boolean> {
  const { error } = await db().from('agenda_tipos_foco').select('id').limit(1)
  return !error
}

export async function carregarAgenda(
  semanaParam: string | undefined,
  supervisorParam: string | undefined,
): Promise<{ ok: true; dados: AgendaDados } | { ok: false; erro: string }> {
  const auth = await getUser()
  if (!auth) return { ok: false, erro: 'Não autenticado' }
  const role = auth.perfil.role

  let supervisorId: string
  if (role === 'supervisor') supervisorId = auth.perfil.id
  else if (ehGestao(role) && supervisorParam) supervisorId = supervisorParam
  else return { ok: false, erro: 'Selecione um supervisor' }

  const semanaInicio = segundaDe(ehData(semanaParam) ? semanaParam : hojeBR())
  const admin = db()

  const { data: sup } = await admin.from('perfis').select('id, nome, role').eq('id', supervisorId).maybeSingle()
  if (!sup || sup.role !== 'supervisor') return { ok: false, erro: 'Supervisor não encontrado' }

  const { data: semanaRow } = await admin
    .from('agenda_semanas')
    .select('id, status, publicada_em')
    .eq('supervisor_id', supervisorId)
    .eq('semana_inicio', semanaInicio)
    .maybeSingle()

  const { data: tiposRaw } = await admin.from('agenda_tipos_foco').select('*').order('ordem').order('nome')
  const tiposTodos = (tiposRaw ?? []) as TipoFoco[]

  let blocos: BlocoView[] = []
  let comentarios: ComentarioView[] = []
  if (semanaRow) {
    const [{ data: bl }, { data: cm }] = await Promise.all([
      admin
        .from('agenda_blocos')
        .select('id, data, periodo, tipo_foco_id, observacao, replanejado, motivo_replanejamento, agenda_blocos_postos(postos(id, nome))')
        .eq('semana_id', semanaRow.id)
        .order('data'),
      admin
        .from('agenda_comentarios')
        .select('id, texto, created_at, autor:autor_id(nome, role)')
        .eq('semana_id', semanaRow.id)
        .order('created_at', { ascending: true }),
    ])
    type BlRaw = Omit<BlocoView, 'postos'> & { agenda_blocos_postos: { postos: { id: string; nome: string } | null }[] }
    blocos = ((bl ?? []) as BlRaw[]).map(b => ({
      id: b.id, data: b.data, periodo: b.periodo, tipo_foco_id: b.tipo_foco_id,
      observacao: b.observacao, replanejado: b.replanejado, motivo_replanejamento: b.motivo_replanejamento,
      postos: b.agenda_blocos_postos.map(p => p.postos).filter((p): p is { id: string; nome: string } => !!p)
        .sort((a, b2) => a.nome.localeCompare(b2.nome)),
    }))
    type CmRaw = { id: string; texto: string; created_at: string; autor: { nome: string | null; role: string | null } | null }
    comentarios = ((cm ?? []) as CmRaw[]).map(c => ({
      id: c.id, texto: c.texto, created_at: c.created_at,
      autor_nome: c.autor?.nome ?? 'Usuário', autor_role: c.autor?.role ?? '',
    }))
  }

  const ehDono = role === 'supervisor' && auth.perfil.id === supervisorId
  const postos = ehDono ? await postosDoSupervisor(supervisorId) : []
  const sugestoes = ehDono ? await calcularSugestoes(supervisorId, semanaInicio, postos, blocos) : []

  // Tipos desativados só aparecem se ainda usados na semana.
  const usados = new Set(blocos.map(b => b.tipo_foco_id))
  const tipos = tiposTodos.filter(t => t.ativo || usados.has(t.id))

  // Check-ins do dia (só o próprio supervisor). Falha = migração 20261012 ainda não aplicada.
  let checkinsHoje: CheckinHoje[] = []
  let geoDisponivel = false
  if (ehDono) {
    const hoje = hojeBR()
    const { data: cks, error: cksErr } = await admin
      .from('agenda_checkins')
      .select('id, posto_id, tipo, created_at, dentro_raio, baixa_precisao, distancia_m')
      .eq('supervisor_id', supervisorId)
      .gte('created_at', `${addDias(hoje, -1)}T00:00:00Z`)
      .order('created_at', { ascending: true })
    geoDisponivel = !cksErr
    checkinsHoje = ((cks ?? []) as CheckinHoje[]).filter(c => dataBR(c.created_at) === hoje)
  }

  return {
    ok: true,
    dados: {
      supervisor: { id: sup.id, nome: sup.nome ?? 'Supervisor' },
      semanaInicio,
      semana: {
        id: semanaRow?.id ?? null,
        status: (semanaRow?.status as 'rascunho' | 'publicada') ?? 'rascunho',
        publicada_em: semanaRow?.publicada_em ?? null,
      },
      blocos,
      tipos,
      postos,
      sugestoes,
      comentarios,
      podeEditar: ehDono,
      checkinsHoje,
      geoDisponivel,
    },
  }
}

async function calcularSugestoes(
  supervisorId: string,
  semanaInicio: string,
  postos: PostoOpt[],
  blocosSemana: BlocoView[],
): Promise<Sugestao[]> {
  if (postos.length === 0) return []
  const admin = db()
  const fimSemana = addDias(semanaInicio, 5)

  const { data: semanas } = await admin
    .from('agenda_semanas')
    .select('id')
    .eq('supervisor_id', supervisorId)
    .gte('semana_inicio', addDias(semanaInicio, -56))
    .lte('semana_inicio', semanaInicio)
  const ids = ((semanas ?? []) as { id: string }[]).map(s => s.id)

  const ultima = new Map<string, string>()
  if (ids.length > 0) {
    const { data } = await admin
      .from('agenda_blocos')
      .select('data, agenda_blocos_postos(posto_id)')
      .in('semana_id', ids)
      .lte('data', fimSemana)
    for (const b of (data ?? []) as { data: string; agenda_blocos_postos: { posto_id: string }[] }[]) {
      for (const p of b.agenda_blocos_postos) {
        const atual = ultima.get(p.posto_id)
        if (!atual || b.data > atual) ultima.set(p.posto_id, b.data)
      }
    }
  }

  const naSemana = new Set(blocosSemana.flatMap(b => b.postos.map(p => p.id)))
  const out: Sugestao[] = []
  for (const p of postos) {
    if (naSemana.has(p.id)) continue
    const ult = ultima.get(p.id) ?? null
    const dias = ult ? diasEntre(ult, semanaInicio) : null
    if (dias !== null && dias <= 14) continue
    out.push({ posto_id: p.id, nome: p.nome, secretaria: p.secretaria, ultima_data: ult, dias })
  }
  out.sort((a, b) => (b.dias ?? 9999) - (a.dias ?? 9999) || a.nome.localeCompare(b.nome))
  return out
}

export async function carregarVisaoGeral(semanaParam: string | undefined): Promise<{
  semanaInicio: string
  cards: CardSupervisor[]
  tipos: TipoFoco[]
}> {
  const auth = await getUser()
  if (!auth || !ehGestao(auth.perfil.role)) return { semanaInicio: segundaDe(hojeBR()), cards: [], tipos: [] }

  const semanaInicio = segundaDe(ehData(semanaParam) ? semanaParam : hojeBR())
  const admin = db()

  const [{ data: sups }, { data: semanas }, { data: tiposRaw }, { data: vinculos }] = await Promise.all([
    admin.from('perfis').select('id, nome').eq('role', 'supervisor').eq('ativo', true).order('nome'),
    admin
      .from('agenda_semanas')
      .select('id, supervisor_id, status, agenda_comentarios(id)')
      .eq('semana_inicio', semanaInicio),
    admin.from('agenda_tipos_foco').select('*').order('ordem'),
    admin.from('config_supervisores_postos').select('supervisor_id, postos(ativo)').eq('ativo', true),
  ])
  const totalPorSup = new Map<string, number>()
  for (const v of (vinculos ?? []) as { supervisor_id: string; postos: { ativo: boolean | null } | null }[]) {
    if (v.postos && v.postos.ativo !== false) totalPorSup.set(v.supervisor_id, (totalPorSup.get(v.supervisor_id) ?? 0) + 1)
  }
  const tipos = (tiposRaw ?? []) as TipoFoco[]
  const corPorTipo = new Map(tipos.map(t => [t.id, t.cor]))

  type SemRaw = { id: string; supervisor_id: string; status: 'rascunho' | 'publicada'; agenda_comentarios: { id: string }[] }
  const semPorSup = new Map(((semanas ?? []) as SemRaw[]).map(s => [s.supervisor_id, s]))
  const semIds = Array.from(semPorSup.values()).map(s => s.id)

  type BlRaw = { semana_id: string; data: string; periodo: string; tipo_foco_id: string; replanejado: boolean; agenda_blocos_postos: { posto_id: string }[] }
  let blocos: BlRaw[] = []
  if (semIds.length > 0) {
    const { data } = await admin
      .from('agenda_blocos')
      .select('semana_id, data, periodo, tipo_foco_id, replanejado, agenda_blocos_postos(posto_id)')
      .in('semana_id', semIds)
    blocos = (data ?? []) as BlRaw[]
  }

  // Check-ins da semana (vazio se a migração 20261012 ainda não foi aplicada).
  const fimSemana = addDias(semanaInicio, 6)
  const hojeStr = hojeBR()
  const cksPorSup = new Map<string, CheckinRaw[]>()
  if (semIds.length > 0) {
    const { data: cks } = await admin
      .from('agenda_checkins')
      .select('id, supervisor_id, posto_id, tipo, latitude, longitude, precisao_m, distancia_m, dentro_raio, baixa_precisao, justificativa, created_at')
      .gte('created_at', `${addDias(semanaInicio, -1)}T00:00:00Z`)
      .lte('created_at', `${addDias(fimSemana, 1)}T23:59:59Z`)
    for (const c of (cks ?? []) as CheckinRaw[]) {
      const d = dataBR(c.created_at)
      if (d < semanaInicio || d > fimSemana) continue
      cksPorSup.set(c.supervisor_id, [...(cksPorSup.get(c.supervisor_id) ?? []), c])
    }
  }
  const nomeTipo = new Map(tipos.map(t => [t.id, t.nome]))

  const cards: CardSupervisor[] = ((sups ?? []) as { id: string; nome: string | null }[]).map(s => {
    const sem = semPorSup.get(s.id)
    const meus = sem ? blocos.filter(b => b.semana_id === sem.id) : []
    const slots: Record<string, string> = {}
    const postosSet = new Set<string>()
    for (const b of meus) {
      slots[`${b.data}|${b.periodo}`] = corPorTipo.get(b.tipo_foco_id) ?? 'slate'
      b.agenda_blocos_postos.forEach(p => postosSet.add(p.posto_id))
    }
    const planos: BlocoPlan[] = meus.flatMap(b =>
      b.agenda_blocos_postos.map(p => ({
        data: b.data,
        periodo: b.periodo as Periodo,
        foco: nomeTipo.get(b.tipo_foco_id) ?? '',
        posto_id: p.posto_id,
      })),
    )
    const { stats } = montarVisitas({
      planos,
      checkins: cksPorSup.get(s.id) ?? [],
      postos: new Map<string, PostoGeo>(),
      hoje: hojeStr,
    })
    return {
      id: s.id,
      nome: s.nome ?? 'Supervisor',
      status: sem ? sem.status : 'sem_agenda',
      slots,
      blocos: meus.length,
      postosDistintos: postosSet.size,
      totalPostos: totalPorSup.get(s.id) ?? 0,
      replanejamentos: meus.filter(b => b.replanejado).length,
      comentarios: sem?.agenda_comentarios.length ?? 0,
      cumprimento: stats.pct,
      faltas: stats.faltas,
      foraRaio: stats.foraRaio,
    }
  })

  return { semanaInicio, cards, tipos }
}

// ─── Escrita (somente o supervisor dono) ──────────────────────────────────────

async function contextoDono(semanaInicio: string) {
  const auth = await getUser()
  if (!auth) return { erro: 'Não autenticado' } as const
  if (auth.perfil.role !== 'supervisor' || auth.perfil.ativo === false) {
    return { erro: 'Somente supervisores montam a própria agenda' } as const
  }
  if (!ehData(semanaInicio) || segundaDe(semanaInicio) !== semanaInicio) return { erro: 'Semana inválida' } as const

  const admin = db()
  const { data: existente } = await admin
    .from('agenda_semanas')
    .select('id, status')
    .eq('supervisor_id', auth.perfil.id)
    .eq('semana_inicio', semanaInicio)
    .maybeSingle()

  let semana = existente as { id: string; status: 'rascunho' | 'publicada' } | null
  if (!semana) {
    const { data: criada, error } = await admin
      .from('agenda_semanas')
      .insert({ supervisor_id: auth.perfil.id, semana_inicio: semanaInicio })
      .select('id, status')
      .single()
    if (error) return { erro: error.message } as const
    semana = criada as { id: string; status: 'rascunho' | 'publicada' }
  }
  return { auth, admin, semana } as const
}

async function registrarNota(admin: AnyClient, semanaId: string, autorId: string, texto: string) {
  await admin.from('agenda_comentarios').insert({ semana_id: semanaId, autor_id: autorId, texto })
}

export async function salvarBloco(input: {
  semanaInicio: string
  data: string
  periodo: Periodo
  tipoFocoId: string
  postoIds: string[]
  observacao: string
  motivo?: string
}): Promise<Resultado> {
  const ctx = await contextoDono(input.semanaInicio)
  if ('erro' in ctx) return { ok: false, erro: ctx.erro }
  const { auth, admin, semana } = ctx

  if (!ehData(input.data) || segundaDe(input.data) !== input.semanaInicio || input.data === addDias(input.semanaInicio, 6)) {
    return { ok: false, erro: 'Data fora da semana (seg–sáb)' }
  }
  if (!PERIODOS_VALIDOS.includes(input.periodo)) return { ok: false, erro: 'Período inválido' }

  const publicada = semana.status === 'publicada'
  const motivo = (input.motivo ?? '').trim()
  if (publicada && motivo.length < 5) return { ok: false, erro: 'Agenda publicada: informe o motivo do replanejamento' }

  const { data: tipo } = await admin.from('agenda_tipos_foco').select('id, nome, ativo').eq('id', input.tipoFocoId).maybeSingle()
  if (!tipo || tipo.ativo === false) return { ok: false, erro: 'Tipo de foco inválido' }

  const permitidos = new Set((await postosDoSupervisor(auth.perfil.id)).map(p => p.id))
  const postoIds = Array.from(new Set(input.postoIds))
  if (postoIds.some(id => !permitidos.has(id))) return { ok: false, erro: 'Posto não pertence ao supervisor' }

  const observacao = input.observacao.trim().slice(0, 500) || null

  const { data: existente } = await admin
    .from('agenda_blocos')
    .select('id, replanejado, motivo_replanejamento')
    .eq('semana_id', semana.id)
    .eq('data', input.data)
    .eq('periodo', input.periodo)
    .maybeSingle()

  let blocoId: string
  if (existente) {
    blocoId = existente.id
    const { error } = await admin
      .from('agenda_blocos')
      .update({
        tipo_foco_id: input.tipoFocoId,
        observacao,
        ...(publicada ? { replanejado: true, motivo_replanejamento: motivo } : {}),
      })
      .eq('id', blocoId)
    if (error) return { ok: false, erro: error.message }
    await admin.from('agenda_blocos_postos').delete().eq('bloco_id', blocoId)
  } else {
    const { data: novo, error } = await admin
      .from('agenda_blocos')
      .insert({
        semana_id: semana.id,
        data: input.data,
        periodo: input.periodo,
        tipo_foco_id: input.tipoFocoId,
        observacao,
        replanejado: publicada,
        motivo_replanejamento: publicada ? motivo : null,
      })
      .select('id')
      .single()
    if (error) return { ok: false, erro: error.message }
    blocoId = novo.id
  }

  if (postoIds.length > 0) {
    const { error } = await admin
      .from('agenda_blocos_postos')
      .insert(postoIds.map(posto_id => ({ bloco_id: blocoId, posto_id })))
    if (error) return { ok: false, erro: error.message }
  }

  if (publicada) {
    await registrarNota(admin, semana.id, auth.perfil.id,
      `🔄 Replanejou ${input.data.split('-').reverse().slice(0, 2).join('/')} (${ROTULO_PERIODO[input.periodo]}): ${tipo.nome}. Motivo: ${motivo}`)
  }

  revalidatePath('/agenda')
  return { ok: true }
}

export async function removerBloco(input: { semanaInicio: string; blocoId: string; motivo?: string }): Promise<Resultado> {
  const ctx = await contextoDono(input.semanaInicio)
  if ('erro' in ctx) return { ok: false, erro: ctx.erro }
  const { auth, admin, semana } = ctx

  const motivo = (input.motivo ?? '').trim()
  if (semana.status === 'publicada' && motivo.length < 5) return { ok: false, erro: 'Agenda publicada: informe o motivo' }

  const { data: bloco } = await admin
    .from('agenda_blocos')
    .select('id, data, periodo')
    .eq('id', input.blocoId)
    .eq('semana_id', semana.id)
    .maybeSingle()
  if (!bloco) return { ok: false, erro: 'Bloco não encontrado' }

  const { error } = await admin.from('agenda_blocos').delete().eq('id', bloco.id)
  if (error) return { ok: false, erro: error.message }

  if (semana.status === 'publicada') {
    await registrarNota(admin, semana.id, auth.perfil.id,
      `🗑️ Removeu bloco de ${bloco.data.split('-').reverse().slice(0, 2).join('/')} (${ROTULO_PERIODO[bloco.periodo as Periodo]}). Motivo: ${motivo}`)
  }
  revalidatePath('/agenda')
  return { ok: true }
}

export async function publicarSemana(semanaInicio: string): Promise<Resultado> {
  const ctx = await contextoDono(semanaInicio)
  if ('erro' in ctx) return { ok: false, erro: ctx.erro }
  const { auth, admin, semana } = ctx
  if (semana.status === 'publicada') return { ok: false, erro: 'Agenda já publicada' }

  const { count } = await admin.from('agenda_blocos').select('id', { count: 'exact', head: true }).eq('semana_id', semana.id)
  if (!count) return { ok: false, erro: 'Adicione ao menos um bloco antes de publicar' }

  const { error } = await admin
    .from('agenda_semanas')
    .update({ status: 'publicada', publicada_em: new Date().toISOString() })
    .eq('id', semana.id)
  if (error) return { ok: false, erro: error.message }

  await registrarNota(admin, semana.id, auth.perfil.id, `📢 Agenda publicada com ${count} bloco(s).`)
  revalidatePath('/agenda')
  return { ok: true }
}

export async function copiarSemanaAnterior(semanaInicio: string): Promise<Resultado> {
  const ctx = await contextoDono(semanaInicio)
  if ('erro' in ctx) return { ok: false, erro: ctx.erro }
  const { auth, admin, semana } = ctx
  if (semana.status === 'publicada') return { ok: false, erro: 'Agenda publicada não aceita cópia' }

  const { count } = await admin.from('agenda_blocos').select('id', { count: 'exact', head: true }).eq('semana_id', semana.id)
  if (count) return { ok: false, erro: 'A semana já tem blocos' }

  const { data: anterior } = await admin
    .from('agenda_semanas')
    .select('id')
    .eq('supervisor_id', auth.perfil.id)
    .eq('semana_inicio', addDias(semanaInicio, -7))
    .maybeSingle()
  if (!anterior) return { ok: false, erro: 'Semana anterior sem agenda' }

  const { data: origem } = await admin
    .from('agenda_blocos')
    .select('data, periodo, tipo_foco_id, observacao, agenda_blocos_postos(posto_id)')
    .eq('semana_id', anterior.id)
  type Org = { data: string; periodo: Periodo; tipo_foco_id: string; observacao: string | null; agenda_blocos_postos: { posto_id: string }[] }
  const lista = (origem ?? []) as Org[]
  if (lista.length === 0) return { ok: false, erro: 'Semana anterior sem blocos' }

  const [{ data: ativos }, permitidos] = await Promise.all([
    admin.from('agenda_tipos_foco').select('id').eq('ativo', true),
    postosDoSupervisor(auth.perfil.id),
  ])
  const tiposAtivos = new Set(((ativos ?? []) as { id: string }[]).map(t => t.id))
  const postosOk = new Set(permitidos.map(p => p.id))

  for (const b of lista) {
    if (!tiposAtivos.has(b.tipo_foco_id)) continue
    const { data: novo, error } = await admin
      .from('agenda_blocos')
      .insert({
        semana_id: semana.id,
        data: addDias(b.data, 7),
        periodo: b.periodo,
        tipo_foco_id: b.tipo_foco_id,
        observacao: b.observacao,
      })
      .select('id')
      .single()
    if (error) return { ok: false, erro: error.message }
    const pids = b.agenda_blocos_postos.map(p => p.posto_id).filter(id => postosOk.has(id))
    if (pids.length > 0) await admin.from('agenda_blocos_postos').insert(pids.map(posto_id => ({ bloco_id: novo.id, posto_id })))
  }

  revalidatePath('/agenda')
  return { ok: true }
}

export async function comentarAgenda(input: { supervisorId: string; semanaInicio: string; texto: string }): Promise<Resultado> {
  const auth = await getUser()
  if (!auth) return { ok: false, erro: 'Não autenticado' }
  const dono = auth.perfil.role === 'supervisor' && auth.perfil.id === input.supervisorId
  if (!dono && !ehGestao(auth.perfil.role)) return { ok: false, erro: 'Sem permissão' }

  const texto = input.texto.trim().slice(0, 1000)
  if (!texto) return { ok: false, erro: 'Comentário vazio' }

  const admin = db()
  const { data: semana } = await admin
    .from('agenda_semanas')
    .select('id')
    .eq('supervisor_id', input.supervisorId)
    .eq('semana_inicio', input.semanaInicio)
    .maybeSingle()
  if (!semana) return { ok: false, erro: 'Esta semana ainda não tem agenda' }

  const { error } = await admin.from('agenda_comentarios').insert({ semana_id: semana.id, autor_id: auth.perfil.id, texto })
  if (error) return { ok: false, erro: error.message }
  revalidatePath('/agenda')
  return { ok: true }
}

// ─── Tipos de foco (admin) ────────────────────────────────────────────────────

export async function listarTiposFoco(): Promise<TipoFoco[]> {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'admin') return []
  const { data } = await db().from('agenda_tipos_foco').select('*').order('ordem').order('nome')
  return (data ?? []) as TipoFoco[]
}

export async function salvarTipoFoco(input: {
  id?: string
  nome: string
  cor: string
  icone: string
  ordem: number
}): Promise<Resultado> {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'admin') return { ok: false, erro: 'Somente administrador' }

  const nome = input.nome.trim()
  if (nome.length < 2) return { ok: false, erro: 'Informe o nome' }
  if (!CORES_FOCO.includes(input.cor as (typeof CORES_FOCO)[number])) return { ok: false, erro: 'Cor inválida' }
  const icone = input.icone.trim().slice(0, 8) || '📌'
  const payload = { nome, cor: input.cor, icone, ordem: Math.trunc(input.ordem) || 0 }

  const admin = db()
  const { error } = input.id
    ? await admin.from('agenda_tipos_foco').update(payload).eq('id', input.id)
    : await admin.from('agenda_tipos_foco').insert(payload)
  if (error) return { ok: false, erro: error.code === '23505' ? 'Já existe um tipo com esse nome' : error.message }
  revalidatePath('/agenda')
  revalidatePath('/agenda/tipos')
  return { ok: true }
}

export async function alternarTipoFoco(id: string, ativo: boolean): Promise<Resultado> {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'admin') return { ok: false, erro: 'Somente administrador' }
  const { error } = await db().from('agenda_tipos_foco').update({ ativo }).eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidatePath('/agenda')
  revalidatePath('/agenda/tipos')
  return { ok: true }
}
