'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/assert-role'
import {
  montarSemana, removerObjetosDosTurnos, TURNO_PADRAO, type TurnoRow,
} from '@/lib/acordos/horario-do-turno'
import { regimeElegivel } from '@/lib/acordos/regras'
import { resolverTipoEscala, FUNCAO_JOVEM_APRENDIZ } from '@/lib/turnos/escala'
import { agruparPorJornada, construirMovimentos } from '@/lib/acordos/movimentos'
import { TEMPLATES } from '@/lib/acordos/templates'
import { montarTextosAcordo, type TurnoHorario } from '@/lib/acordos/montar'
import { validarAcordo } from '@/lib/acordos/validar'
import { participantesValidos } from '@/lib/acordos/participantes-validos'
import { reconstruirCampos } from '@/lib/acordos/campos-form'
import { planejarSincronizacao, type MovExistente } from '@/lib/acordos/sincronizar'
import { nomesRecentesDistintos } from '@/lib/acordos/resumo'
import type { Ausencia, CamposAcordo, FuncionarioCalc, MapaAusencias, SemanaTurno } from '@/lib/acordos/tipos'
import { carregarCalendario } from '@/lib/calendario/mogi'
import { calendarioParaMapa } from '@/lib/calendario/mapa'

const TEMPLATES_VALIDOS = ['T1', 'T2', 'T3', 'T4', 'T5']

export interface AcordoPostoItem {
  id: string
  nome: string
  secretaria: string | null
}

export interface AcordoFuncionarioItem {
  id: string
  nome: string
  funcao: string | null
  status: string
  turno_nome?: string | null
  hora_entrada?: string | null
  hora_saida_seg_qui?: string | null
}

export interface FuncionarioParaAcordo extends AcordoFuncionarioItem {
  regime: string
  elegivel: boolean
  motivo_inelegivel: string | null
  semana: SemanaTurno
  sem_turno: boolean
  posto_id: string | null
}

export type { TurnoHorario }

// ─── Normaliza horario_semana v1 ou v2 → TurnoHorario[] ──────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizarHorarios(raw: any, funcionarios: AcordoFuncionarioItem[]): TurnoHorario[] {
  if (!raw) return []
  if (raw._v === 2 && Array.isArray(raw.turnos)) return raw.turnos as TurnoHorario[]
  // v1: objeto dia→string, todos os funcionários num turno único
  return [{
    label: 'Turno Único',
    horario: raw as Record<string, string>,
    funcionario_ids: funcionarios.map(f => f.id),
  }]
}

export interface AcordoCompensacao {
  id: string
  titulo: string
  tipo: 'individual' | 'coletivo'
  subtipo: 'evento' | 'antecipado' | null
  postos: AcordoPostoItem[]
  funcionarios: AcordoFuncionarioItem[]
  horarios: TurnoHorario[]
  descricao_acordo: string
  data_documento: string
  criado_por: string | null
  criado_por_nome: string | null
  created_at: string
  entregue_rh: boolean
  entregue_em: string | null
  /** O acordo tem formulário guardado ou template para reabrir completo no "Editar" (senão, editor simples). */
  editavel_completo?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

export async function listarAcordos(filters?: {
  mes?: number
  ano?: number
}): Promise<AcordoCompensacao[]> {
  const supabase = createClient() as AnyClient

  let query = supabase
    .from('acordos_compensacao')
    .select('*')
    .order('data_documento', { ascending: false })

  if (filters?.mes && filters?.ano) {
    const y = filters.ano
    const m = String(filters.mes).padStart(2, '0')
    const nextM = filters.mes === 12 ? 1 : filters.mes + 1
    const nextY = filters.mes === 12 ? y + 1 : y
    query = query
      .gte('data_documento', `${y}-${m}-01`)
      .lt('data_documento', `${nextY}-${String(nextM).padStart(2, '0')}-01`)
  } else if (filters?.ano) {
    query = query
      .gte('data_documento', `${filters.ano}-01-01`)
      .lt('data_documento', `${filters.ano + 1}-01-01`)
  }

  const { data } = await query

  const rows = (data ?? []) as AnyClient[]

  // Resolve criado_por → nome via perfis
  const criadoPorIds = Array.from(new Set(rows.map((r: AnyClient) => r.criado_por).filter(Boolean))) as string[]
  const nomesMap: Record<string, string> = {}
  if (criadoPorIds.length > 0) {
    const { data: perfisData } = await (createClient() as AnyClient)
      .from('perfis')
      .select('id, nome')
      .in('id', criadoPorIds)
    for (const p of (perfisData ?? []) as { id: string; nome: string | null }[]) {
      if (p.nome) nomesMap[p.id] = p.nome
    }
  }

  return rows.map((r: AnyClient) => {
    const funcionarios = (r.funcionarios ?? []) as AcordoFuncionarioItem[]
    return {
      id:              r.id,
      titulo:          r.titulo,
      tipo:            r.tipo,
      subtipo:         r.subtipo ?? null,
      postos:          r.postos ?? [],
      funcionarios,
      horarios:        normalizarHorarios(r.horario_semana, funcionarios),
      descricao_acordo: r.descricao_acordo,
      data_documento:  r.data_documento,
      criado_por:      r.criado_por,
      criado_por_nome: r.criado_por ? (nomesMap[r.criado_por] ?? null) : null,
      created_at:      r.created_at,
      entregue_rh:     r.entregue_rh ?? false,
      entregue_em:     r.entregue_em ?? null,
      editavel_completo: !!r.campos || TEMPLATES_VALIDOS.includes(r.template_id),
    } as AcordoCompensacao
  })
}

const REGEX_MIGRATION = /does not exist|schema cache|Could not find/i
const MSG_MIGRATION = 'A migration de acordos (20260922) ainda não foi aplicada no banco.'

function dataReal(iso: unknown): iso is string {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const [a, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d))
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

function datasDeParticipantes(c: CamposAcordo): string[] {
  return Object.values(c.participantes ?? {}).flatMap(p => p.folgas)
}

/** Todas as datas de `campos` vêm do navegador: precisam ser reais e estar num intervalo de anos plausível. */
function datasDosCamposValidas(c: CamposAcordo): boolean {
  if (!Array.isArray(c.datasAjuste)) return false
  const folgas = c.folgasPorFuncionario
  if (folgas !== undefined && (typeof folgas !== 'object' || folgas === null || Array.isArray(folgas))) return false
  if (c.datasEvento !== undefined && !Array.isArray(c.datasEvento)) return false
  if (!participantesValidos(c)) return false
  if (c.minutosFolga !== undefined && !(Number.isInteger(c.minutosFolga) && c.minutosFolga >= 0 && c.minutosFolga <= 1440)) return false
  const anoAtual = new Date().getFullYear()
  const datas = [c.dataEvento, c.dataFolga, c.prazoLimite, ...(c.datasEvento ?? []), ...Object.values(folgas ?? {}), ...datasDeParticipantes(c), ...c.datasAjuste].filter(d => d !== undefined && d !== null && d !== '')
  return datas.every(d => dataReal(d) && Number(d.slice(0, 4)) >= anoAtual - 1 && Number(d.slice(0, 4)) <= anoAtual + 3)
}

function anosDoAcordo(c: CamposAcordo): number[] {
  const datas = [c.dataEvento, c.dataFolga, c.prazoLimite, ...(c.datasEvento ?? []), ...Object.values(c.folgasPorFuncionario ?? {}), ...datasDeParticipantes(c), ...c.datasAjuste].filter((d): d is string => !!d)
  return Array.from(new Set(datas.map(d => Number(d.slice(0, 4)))))
}

type DadosAcordo = {
  titulo: string
  tipo: 'individual' | 'coletivo'
  postos: AcordoPostoItem[]
  funcionarioIds: string[]
  data_documento: string
  campos: CamposAcordo
}

interface AcordoPreparado {
  funcs: FuncionarioParaAcordo[]
  postos: AcordoPostoItem[]
  horarios: TurnoHorario[]
  descricao: string
  movimentos: { funcionario_id: string; data: string; minutos: number; papel: 'origem' | 'quitacao' }[]
}

/** Validações, textos, postos e movimentos de um acordo: o mesmo caminho para criar e para editar. */
async function prepararAcordo(dados: DadosAcordo): Promise<AcordoPreparado | { error: string }> {
  if (!dados.titulo.trim()) return { error: 'Informe o título do acordo.' }
  if (!Array.isArray(dados.postos) || !dados.postos.length) return { error: 'Selecione ao menos um posto.' }
  if (dados.tipo !== 'individual' && dados.tipo !== 'coletivo') return { error: 'Tipo de acordo inválido.' }
  if (!dataReal(dados.data_documento)) return { error: 'Data do documento inválida. Use o formato AAAA-MM-DD.' }
  if (!dados.campos || !datasDosCamposValidas(dados.campos)) {
    return { error: 'Data inválida ou fora do intervalo permitido.' }
  }
  if (!Array.isArray(dados.funcionarioIds)) return { error: 'Selecione ao menos um funcionário.' }

  const ids = Array.from(new Set(dados.funcionarioIds))
  let funcs: FuncionarioParaAcordo[]
  try {
    funcs = await carregarFuncionarios({ ids })
  } catch {
    return { error: 'Não foi possível carregar os funcionários. Tente novamente.' }
  }
  if (ids.length === 0 || funcs.length !== ids.length) {
    return { error: 'Algum funcionário não foi encontrado ou você não tem acesso a ele.' }
  }
  if (Object.keys(dados.campos.folgasPorFuncionario ?? {}).some(k => !ids.includes(k))) {
    return { error: 'Há data de folga para um funcionário que não faz parte do acordo.' }
  }
  if (Object.keys(dados.campos.participantes ?? {}).some(k => !ids.includes(k))) {
    return { error: 'Há período ou folga para um funcionário que não faz parte do acordo.' }
  }
  const inelegivel = funcs.find(f => !f.elegivel)
  if (inelegivel) return { error: `${inelegivel.nome}: ${inelegivel.motivo_inelegivel}` }

  const calc = paraCalc(funcs)
  let feriados: ReturnType<typeof calendarioParaMapa>
  try {
    feriados = calendarioParaMapa(await carregarCalendario(anosDoAcordo(dados.campos)))
  } catch {
    return { error: 'Não foi possível carregar o calendário de feriados. Tente novamente.' }
  }
  // Um acordo por evento: funcionários com jornadas/horários diferentes formam grupos de compensação,
  // cada um validado e com seu próprio parágrafo; cada turno cai inteiro dentro de um grupo.
  const grupos = agruparPorJornada(dados.campos, calc)
  if (grupos.length === 0) return { error: 'Selecione ao menos um funcionário.' }
  const vistos = new Set<string>()
  const erros: string[] = []
  for (const g of grupos) {
    for (const a of validarAcordo(dados.campos, g, feriados)) {
      if (a.nivel === 'erro' && !vistos.has(a.mensagem)) {
        vistos.add(a.mensagem)
        erros.push(a.mensagem)
      }
    }
  }
  if (erros.length) return { error: erros.join(' ') }

  const textos = montarTextosAcordo(dados.campos, calc)
  if (!textos.ok) return { error: textos.erro }
  const { horarios, descricao } = textos

  // Postos montados no servidor (não confiar no que veio do navegador); leitura com RLS de sessão.
  const postoIdsDosFuncs = Array.from(new Set(funcs.map(f => f.posto_id).filter((p): p is string => !!p)))
  if (postoIdsDosFuncs.length === 0) return { error: 'Os funcionários selecionados não estão vinculados a um posto.' }
  const { data: postosDb, error: errPostos } = await (createClient() as AnyClient)
    .from('postos')
    .select('id, nome, secretaria')
    .in('id', postoIdsDosFuncs)
  if (errPostos) return { error: 'Não foi possível carregar os postos. Tente novamente.' }
  const postos: AcordoPostoItem[] = ((postosDb ?? []) as AcordoPostoItem[]).map(p => ({
    id: p.id, nome: p.nome, secretaria: p.secretaria ?? null,
  }))
  if (postos.length === 0) return { error: 'Postos dos funcionários não encontrados.' }

  const movimentos = construirMovimentos(dados.campos, calc).map(m => ({
    funcionario_id: m.funcionarioId, data: m.data, minutos: m.minutos, papel: m.papel,
  }))
  return { funcs, postos, horarios, descricao, movimentos }
}

const colunaAusente = (msg: string, coluna: string) => REGEX_MIGRATION.test(msg) && msg.includes(coluna)

export async function criarAcordo(dados: DadosAcordo): Promise<{ id: string } | { error: string }> {
  const guard = await requireRole(['admin', 'coordenador', 'supervisor'])
  if (!guard.success) return { error: guard.error }
  const prep = await prepararAcordo(dados)
  if ('error' in prep) return { error: prep.error }
  const { funcs, postos, horarios, descricao } = prep

  const admin = createAdminClient() as AnyClient
  const linha = {
    titulo: dados.titulo.trim(),
    tipo: dados.tipo,
    subtipo: TEMPLATES[dados.campos.template].subtipo,
    postos,
    funcionarios: funcs.map(f => ({ id: f.id, nome: f.nome, funcao: f.funcao, status: f.status })),
    horario_semana: { _v: 2, turnos: horarios },
    descricao_acordo: descricao,
    data_documento: dados.data_documento,
    criado_por: guard.auth.user.id,
    evento_data: dados.campos.dataEvento ?? null,
    evento_nome: dados.campos.nomeEvento?.trim() || null,
    template_id: dados.campos.template,
    prazo_limite: dados.campos.prazoLimite ?? null,
    origem: 'manual',
  }
  // `campos` (formulário guardado, para editar depois) depende da migration 20261001; sem ela grava sem essa coluna
  let res = await admin.from('acordos_compensacao').insert({ ...linha, campos: dados.campos }).select('id').single()
  if (res.error && colunaAusente(res.error.message, 'campos')) {
    res = await admin.from('acordos_compensacao').insert(linha).select('id').single()
  }
  const { data, error } = res
  if (error) return { error: REGEX_MIGRATION.test(error.message) ? MSG_MIGRATION : error.message }

  const { error: errMov } = await admin.from('acordo_movimentos').insert(prep.movimentos.map(m => ({ acordo_id: data.id, ...m })))
  if (errMov) {
    const { error: errDel } = await admin.from('acordos_compensacao').delete().eq('id', data.id)
    if (errDel) {
      return {
        error: `Não foi possível gravar os movimentos e o acordo incompleto não pôde ser removido (id ${data.id}). Avise o suporte para excluí-lo.`,
      }
    }
    return {
      error: REGEX_MIGRATION.test(errMov.message)
        ? MSG_MIGRATION
        : `Não foi possível gravar os movimentos do acordo: ${errMov.message}`,
    }
  }

  revalidatePath('/acordos')
  return { id: data.id }
}

export async function excluirAcordo(id: string): Promise<{ error?: string }> {
  const guard = await requireRole(['admin', 'coordenador', 'supervisor'])
  if (!guard.success) return { error: guard.error }

  const { error } = await (createAdminClient() as AnyClient).from('acordos_compensacao').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/acordos')
  return {}
}

export async function buscarPostosParaAcordo(): Promise<AcordoPostoItem[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('postos')
    .select('id, nome, secretaria')
    .eq('ativo', true)
    .order('nome')
  return (data ?? []) as AcordoPostoItem[]
}

/** Nomes de evento usados nos acordos mais recentes (distintos, até 8), para atalhos no modal. Erro → []. */
export async function buscarNomesEventoRecentes(): Promise<string[]> {
  try {
    const { data, error } = await (createClient() as AnyClient)
      .from('acordos_compensacao')
      .select('evento_nome, created_at')
      .not('evento_nome', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) return []
    return nomesRecentesDistintos(((data ?? []) as { evento_nome: string | null }[]).map(r => r.evento_nome), 8)
  } catch {
    return []
  }
}

const TAM_LOTE = 100 // evita URL gigante no PostgREST com centenas de ids

async function emLotes<T>(valores: string[], fn: (lote: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < valores.length; i += TAM_LOTE) out.push(...(await fn(valores.slice(i, i + TAM_LOTE))))
  return out
}

async function carregarFuncionarios(filtro: { postoIds?: string[]; ids?: string[] }): Promise<FuncionarioParaAcordo[]> {
  const supabase = createClient() as AnyClient
  const valores = filtro.ids ?? filtro.postoIds ?? []
  const coluna = filtro.ids ? 'id' : 'posto_id'
  if (!valores.length) return []

  type Row = { id: string; nome: string; status: string; posto_id: string | null; funcoes: { nome: string } | null }
  const rows = await emLotes<Row>(valores, async lote => {
    const { data, error } = await supabase
      .from('funcionarios')
      .select('id, nome, status, posto_id, funcoes!funcao_id(nome)')
      .in(coluna, lote)
      .not('status', 'eq', 'desligado')
      .order('nome')
    if (error) throw new Error('Falha ao carregar funcionários')
    return (data ?? []) as Row[]
  })
  if (!rows.length) return []

  type TurnoJoin = { funcionario_id: string; turnos_postos: (TurnoRow & { nome: string }) | null }
  const horarios = await emLotes<TurnoJoin>(rows.map(r => r.id), async lote => {
    const { data, error } = await supabase
      .from('horarios_funcionarios')
      .select('funcionario_id, turnos_postos!turno_id(*)')
      .in('funcionario_id', lote)
      .is('data_fim', null)
    if (error) throw new Error('Falha ao carregar horários dos funcionários')
    return (data ?? []) as TurnoJoin[]
  })
  const turnoPorFunc = new Map<string, TurnoRow & { nome: string }>()
  for (const h of horarios) if (h.turnos_postos) turnoPorFunc.set(h.funcionario_id, h.turnos_postos)

  const postoIds = Array.from(new Set(rows.map(r => r.posto_id).filter((p): p is string => !!p)))
  // config_escalas_postos só é legível por admin (RLS); os postos aqui já passaram pela RLS de sessão via funcionários.
  const admin = createAdminClient() as AnyClient
  const escalas = await emLotes<{ posto_id: string; regime: string }>(postoIds, async lote => {
    const { data, error } = await admin.from('config_escalas_postos').select('posto_id, regime').in('posto_id', lote)
    if (error) throw new Error('Falha ao carregar escalas dos postos')
    return (data ?? []) as { posto_id: string; regime: string }[]
  })
  const regimePosto = new Map(escalas.map(e => [e.posto_id, e.regime]))

  return rows.map(r => {
    const turno = turnoPorFunc.get(r.id) ?? null
    const funcao = r.funcoes?.nome ?? null
    const jovem = (funcao ?? '').toUpperCase() === FUNCAO_JOVEM_APRENDIZ
    const regime = jovem
      ? 'jovem_aprendiz'
      : resolverTipoEscala(turno?.tipo_escala ?? (r.posto_id ? regimePosto.get(r.posto_id) : null))
    const elegivel = regimeElegivel(regime)
    return {
      id: r.id,
      nome: r.nome,
      funcao,
      status: r.status,
      turno_nome: turno?.nome ?? null,
      regime,
      elegivel,
      motivo_inelegivel: elegivel
        ? null
        : jovem
          ? 'Jovem aprendiz: compensação de jornada vedada (art. 432 CLT).'
          : `Escala ${regime} não é elegível a acordo de compensação.`,
      semana: montarSemana(turno ?? TURNO_PADRAO),
      sem_turno: !turno,
      posto_id: r.posto_id,
    }
  })
}

function paraCalc(funcs: FuncionarioParaAcordo[]): FuncionarioCalc[] {
  return funcs.map(f => ({
    id: f.id, nome: f.nome, status: f.status, regime: f.regime, semana: f.semana, semTurno: f.sem_turno,
  }))
}

export async function buscarFuncionariosPorPostos(postoIds: string[]): Promise<FuncionarioParaAcordo[]> {
  return carregarFuncionarios({ postoIds })
}

export async function marcarEntregueRH(id: string): Promise<{ error?: string }> {
  const guard = await requireRole(['admin', 'coordenador', 'supervisor'])
  if (!guard.success) return { error: guard.error }

  const { error } = await (createAdminClient() as AnyClient)
    .from('acordos_compensacao')
    .update({ entregue_rh: true, entregue_em: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/acordos')
  return {}
}

export async function editarAcordo(
  id: string,
  dados: { titulo: string; data_documento: string; descricao_acordo: string; subtipo?: 'evento' | 'antecipado' | null }
): Promise<{ error?: string }> {
  const guard = await requireRole(['admin', 'coordenador', 'supervisor'])
  if (!guard.success) return { error: guard.error }

  const admin = createAdminClient() as AnyClient
  const { data: atual, error: errLeitura } = await admin
    .from('acordos_compensacao')
    .select('descricao_acordo, horario_semana')
    .eq('id', id)
    .maybeSingle()
  if (errLeitura) return { error: errLeitura.message }
  if (!atual) return { error: 'Acordo não encontrado.' }

  const update: Record<string, unknown> = {
    titulo: dados.titulo,
    data_documento: dados.data_documento,
    descricao_acordo: dados.descricao_acordo,
    subtipo: dados.subtipo ?? null,
  }
  // Texto editado à mão: os parágrafos por turno (`objeto`) ficam desatualizados; sem eles o PDF usa o parágrafo único.
  if (dados.descricao_acordo !== atual.descricao_acordo) {
    const semObjetos = removerObjetosDosTurnos(atual.horario_semana)
    if (semObjetos !== atual.horario_semana) update.horario_semana = semObjetos
  }

  const { error } = await admin.from('acordos_compensacao').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/acordos')
  return {}
}

/**
 * Atestados, afastamentos e férias dos funcionários que cruzam o período [de, ate] (datas ISO) do acordo.
 * Leitura com a sessão do usuário (RLS). Erro → null: o modal segue sem a projeção.
 */
export async function buscarAusenciasParaAcordo(
  funcionarioIds: string[], de: string, ate: string,
): Promise<MapaAusencias | null> {
  if (!Array.isArray(funcionarioIds) || !dataReal(de) || !dataReal(ate) || funcionarioIds.length === 0) return {}
  const supabase = createClient() as AnyClient
  const out: MapaAusencias = {}
  const push = (id: string, a: Ausencia) => { (out[id] ??= []).push(a) }
  try {
    const atestados = await emLotes<{ funcionario_id: string; data_inicio: string; data_fim: string }>(funcionarioIds, async lote => {
      const { data, error } = await supabase.from('atestados').select('funcionario_id, data_inicio, data_fim')
        .in('funcionario_id', lote).lte('data_inicio', ate).gte('data_fim', de)
      if (error) throw error
      return data ?? []
    })
    for (const a of atestados) push(a.funcionario_id, { tipo: 'atestado', inicio: a.data_inicio, fim: a.data_fim })

    const afast = await emLotes<{ funcionario_id: string; data_inicio: string; data_fim_prevista: string | null; data_fim_real: string | null }>(funcionarioIds, async lote => {
      const { data, error } = await supabase.from('afastamentos').select('funcionario_id, data_inicio, data_fim_prevista, data_fim_real')
        .in('funcionario_id', lote).lte('data_inicio', ate)
      if (error) throw error
      return data ?? []
    })
    for (const a of afast) {
      const fim = a.data_fim_real ?? a.data_fim_prevista ?? '9999-12-31' // sem previsão de volta: segue afastado
      if (fim >= de) push(a.funcionario_id, { tipo: 'afastamento', inicio: a.data_inicio, fim })
    }

    const ferias = await emLotes<{ funcionario_id: string; data_inicio: string | null; data_fim: string | null }>(funcionarioIds, async lote => {
      const { data, error } = await supabase.from('ferias').select('funcionario_id, data_inicio, data_fim')
        .in('funcionario_id', lote).in('status', ['agendado', 'aprovado', 'em_curso', 'concluido'])
        .lte('data_inicio', ate).gte('data_fim', de)
      if (error) throw error
      return data ?? []
    })
    for (const f of ferias) if (f.data_inicio && f.data_fim) push(f.funcionario_id, { tipo: 'ferias', inicio: f.data_inicio, fim: f.data_fim })
  } catch {
    return null
  }
  return out
}

// ─── Edição do acordo (reabre o formulário completo) ─────────────────────────

export interface AcordoParaEdicao {
  id: string
  titulo: string
  tipo: 'individual' | 'coletivo'
  data_documento: string
  campos: CamposAcordo
  /** true: acordo antigo, formulário reconstruído a partir dos movimentos (pode faltar dado). */
  reconstruido: boolean
  faltando: string[]
  postoIds: string[]
  funcionarioIds: string[]
  entregue_rh: boolean
  descricao_acordo: string
}


/** Dados para reabrir o acordo no formulário: o formulário guardado, ou o reconstruído dos movimentos (acordos antigos). */
export async function carregarAcordoParaEdicao(id: string): Promise<AcordoParaEdicao | { error: string }> {
  const guard = await requireRole(['admin', 'coordenador', 'supervisor'])
  if (!guard.success) return { error: guard.error }
  const supabase = createClient() as AnyClient
  const { data: row, error } = await supabase.from('acordos_compensacao').select('*').eq('id', id).maybeSingle()
  if (error) return { error: 'Não foi possível carregar o acordo.' }
  if (!row) return { error: 'Acordo não encontrado ou sem acesso.' }

  const funcionarioIds = ((row.funcionarios ?? []) as { id: string }[]).map(f => f.id)
  const postoIds = ((row.postos ?? []) as { id: string }[]).map(p => p.id)
  const base = {
    id: row.id as string,
    titulo: row.titulo as string,
    tipo: row.tipo as 'individual' | 'coletivo',
    data_documento: String(row.data_documento).slice(0, 10),
    postoIds,
    funcionarioIds,
    entregue_rh: !!row.entregue_rh,
    descricao_acordo: row.descricao_acordo as string,
  }

  const guardado = row.campos as CamposAcordo | null
  if (guardado && TEMPLATES_VALIDOS.includes(guardado.template)) {
    return { ...base, campos: guardado, reconstruido: false, faltando: [] }
  }
  if (!TEMPLATES_VALIDOS.includes(row.template_id)) return { error: 'Este acordo é antigo e não tem dados estruturados para editar.' }
  const { data: movs, error: errMov } = await supabase
    .from('acordo_movimentos').select('funcionario_id, data, minutos, papel').eq('acordo_id', id)
  if (errMov) return { error: 'Não foi possível carregar os movimentos do acordo.' }
  const { campos, faltando } = reconstruirCampos(
    row.template_id,
    { evento_data: row.evento_data, evento_nome: row.evento_nome, prazo_limite: row.prazo_limite },
    (movs ?? []).map((m: { funcionario_id: string; data: string; minutos: number; papel: 'origem' | 'quitacao' }) => ({ ...m, data: String(m.data).slice(0, 10) })),
  )
  return { ...base, campos, reconstruido: true, faltando }
}

/**
 * Salva a edição: revalida tudo como na criação, regenera textos e turnos e sincroniza os movimentos.
 * Movimentos já cumpridos/verificados não são apagados nem alterados: se a edição mexeria neles, nada é salvo.
 */
export async function atualizarAcordo(
  id: string,
  dados: DadosAcordo & { descricaoManual?: string | null; confirmarEntregue?: boolean },
): Promise<{ ok: true } | { error: string; precisaConfirmar?: boolean }> {
  const guard = await requireRole(['admin', 'coordenador', 'supervisor'])
  if (!guard.success) return { error: guard.error }

  const admin = createAdminClient() as AnyClient
  // acesso: o acordo precisa ser visível para a sessão (RLS) antes de editar com o service role
  const { data: visivel } = await (createClient() as AnyClient).from('acordos_compensacao').select('id').eq('id', id).maybeSingle()
  if (!visivel) return { error: 'Acordo não encontrado ou sem acesso.' }
  const { data: atual, error: errAtual } = await admin.from('acordos_compensacao').select('entregue_rh').eq('id', id).maybeSingle()
  if (errAtual || !atual) return { error: 'Acordo não encontrado.' }
  if (atual.entregue_rh && !dados.confirmarEntregue) {
    return { error: 'Este acordo já foi entregue ao RH. Confirme para editar.', precisaConfirmar: true }
  }
  if (dados.descricaoManual !== undefined && dados.descricaoManual !== null && !dados.descricaoManual.trim()) {
    return { error: 'O texto manual do acordo não pode ficar vazio.' }
  }

  const prep = await prepararAcordo(dados)
  if ('error' in prep) return { error: prep.error }
  const { funcs, postos, horarios, descricao } = prep

  // ── movimentos: sincroniza sem tocar no que já foi cumprido ──
  const { data: existentesDb, error: errEx } = await admin
    .from('acordo_movimentos').select('id, funcionario_id, data, minutos, papel, status').eq('acordo_id', id)
  if (errEx) return { error: 'Não foi possível ler os movimentos do acordo.' }
  const { apagar, atualizar, inserir: novosMov, travados } = planejarSincronizacao((existentesDb ?? []) as MovExistente[], prep.movimentos)
  if (travados.length) {
    return { error: `A edição mudaria movimentos já cumpridos ou verificados (${travados.slice(0, 5).join(', ')}). Ajuste esses dias pelo controle do acordo.` }
  }
  const inserir = novosMov.map(m => ({ acordo_id: id, ...m }))

  if (inserir.length) {
    const { error } = await admin.from('acordo_movimentos').insert(inserir)
    if (error) return { error: `Não foi possível gravar os movimentos: ${error.message}` }
  }
  for (const u of atualizar) {
    const { error } = await admin.from('acordo_movimentos').update({ minutos: u.minutos }).eq('id', u.id)
    if (error) return { error: `Não foi possível atualizar os movimentos: ${error.message}` }
  }
  if (apagar.length) {
    const { error } = await admin.from('acordo_movimentos').delete().in('id', apagar)
    if (error) return { error: `Não foi possível remover movimentos antigos: ${error.message}` }
  }

  // texto manual: vale como está e os parágrafos por turno saem (o PDF usa o parágrafo único)
  const manual = dados.descricaoManual?.trim()
  const turnos = manual ? horarios.map(({ objeto, ...resto }) => { void objeto; return resto }) : horarios
  const linha = {
    titulo: dados.titulo.trim(),
    tipo: dados.tipo,
    subtipo: TEMPLATES[dados.campos.template].subtipo,
    postos,
    funcionarios: funcs.map(f => ({ id: f.id, nome: f.nome, funcao: f.funcao, status: f.status })),
    horario_semana: { _v: 2, turnos },
    descricao_acordo: manual || descricao,
    data_documento: dados.data_documento,
    evento_data: dados.campos.dataEvento ?? null,
    evento_nome: dados.campos.nomeEvento?.trim() || null,
    template_id: dados.campos.template,
    prazo_limite: dados.campos.prazoLimite ?? null,
  }
  const extras = { campos: dados.campos, editado_em: new Date().toISOString(), editado_por: guard.auth.user.id }
  let { error } = await admin.from('acordos_compensacao').update({ ...linha, ...extras }).eq('id', id)
  if (error && (colunaAusente(error.message, 'campos') || colunaAusente(error.message, 'editado'))) {
    ;({ error } = await admin.from('acordos_compensacao').update(linha).eq('id', id))
  }
  if (error) return { error: error.message }

  revalidatePath('/acordos')
  return { ok: true }
}
