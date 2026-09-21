'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/assert-role'
import {
  montarSemana, semanaParaTexto, assinaturaSemana, TURNO_PADRAO, type TurnoRow,
} from '@/lib/acordos/horario-do-turno'
import { regimeElegivel } from '@/lib/acordos/regras'
import { resolverTipoEscala, FUNCAO_JOVEM_APRENDIZ } from '@/lib/turnos/escala'
import { construirMovimentos, resumoCalculo } from '@/lib/acordos/movimentos'
import { gerarObjeto, TEMPLATES } from '@/lib/acordos/templates'
import { temErro, validarAcordo } from '@/lib/acordos/validar'
import type { CamposAcordo, FuncionarioCalc, SemanaTurno } from '@/lib/acordos/tipos'
import { carregarCalendario } from '@/lib/calendario/mogi'
import { calendarioParaMapa } from '@/lib/calendario/mapa'

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
}

export interface TurnoHorario {
  label: string
  horario: Record<string, string>   // dia -> "07:00 às 12:00 / 13:12 às 17:00"
  funcionario_ids: string[]
}

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
    } as AcordoCompensacao
  })
}

function anosDoAcordo(c: CamposAcordo): number[] {
  const datas = [c.dataEvento, c.dataFolga, c.prazoLimite, ...c.datasAjuste].filter((d): d is string => !!d)
  return Array.from(new Set(datas.map(d => Number(d.slice(0, 4)))))
}

export async function criarAcordo(dados: {
  titulo: string
  tipo: 'individual' | 'coletivo'
  postos: AcordoPostoItem[]
  funcionarioIds: string[]
  data_documento: string
  campos: CamposAcordo
}): Promise<{ id: string } | { error: string }> {
  const guard = await requireRole(['admin', 'coordenador', 'supervisor'])
  if (!guard.success) return { error: guard.error }
  if (!dados.titulo.trim()) return { error: 'Informe o título do acordo.' }
  if (!dados.postos.length) return { error: 'Selecione ao menos um posto.' }

  const ids = Array.from(new Set(dados.funcionarioIds))
  const funcs = await carregarFuncionarios({ ids })
  if (ids.length === 0 || funcs.length !== ids.length) {
    return { error: 'Algum funcionário não foi encontrado ou você não tem acesso a ele.' }
  }
  const inelegivel = funcs.find(f => !f.elegivel)
  if (inelegivel) return { error: `${inelegivel.nome}: ${inelegivel.motivo_inelegivel}` }

  const calc = paraCalc(funcs)
  const feriados = calendarioParaMapa(await carregarCalendario(anosDoAcordo(dados.campos)))
  const achados = validarAcordo(dados.campos, calc, feriados)
  if (temErro(achados)) {
    return { error: achados.filter(a => a.nivel === 'erro').map(a => a.mensagem).join(' ') }
  }
  const texto = gerarObjeto(dados.campos, resumoCalculo(dados.campos, calc))
  if (!texto.ok) return { error: texto.erro }

  const porSemana = new Map<string, FuncionarioParaAcordo[]>()
  for (const f of funcs) {
    const chave = assinaturaSemana(f.semana)
    porSemana.set(chave, [...(porSemana.get(chave) ?? []), f])
  }
  const grupos = Array.from(porSemana.values())
  const horarios: TurnoHorario[] = grupos.map((g, i) => ({
    label: grupos.length === 1 ? 'Turno Único' : `Turno ${String.fromCharCode(65 + i)}`,
    horario: semanaParaTexto(g[0].semana),
    funcionario_ids: g.map(f => f.id),
  }))

  const admin = createAdminClient() as AnyClient
  const { data, error } = await admin
    .from('acordos_compensacao')
    .insert({
      titulo: dados.titulo.trim(),
      tipo: dados.tipo,
      subtipo: TEMPLATES[dados.campos.template].subtipo,
      postos: dados.postos,
      funcionarios: funcs.map(f => ({ id: f.id, nome: f.nome, funcao: f.funcao, status: f.status })),
      horario_semana: { _v: 2, turnos: horarios },
      descricao_acordo: texto.texto,
      data_documento: dados.data_documento,
      criado_por: guard.auth.user.id,
      evento_data: dados.campos.dataEvento ?? null,
      evento_nome: dados.campos.nomeEvento?.trim() || null,
      template_id: dados.campos.template,
      prazo_limite: dados.campos.prazoLimite ?? null,
      origem: 'manual',
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  const movimentos = construirMovimentos(dados.campos, calc).map(m => ({
    acordo_id: data.id,
    funcionario_id: m.funcionarioId,
    data: m.data,
    minutos: m.minutos,
    papel: m.papel,
  }))
  const { error: errMov } = await admin.from('acordo_movimentos').insert(movimentos)
  if (errMov) {
    await admin.from('acordos_compensacao').delete().eq('id', data.id)
    return { error: `Não foi possível gravar os movimentos do acordo: ${errMov.message}` }
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
    const { data } = await supabase
      .from('funcionarios')
      .select('id, nome, status, posto_id, funcoes!funcao_id(nome)')
      .in(coluna, lote)
      .not('status', 'eq', 'desligado')
      .order('nome')
    return (data ?? []) as Row[]
  })
  if (!rows.length) return []

  type TurnoJoin = { funcionario_id: string; turnos_postos: (TurnoRow & { nome: string }) | null }
  const horarios = await emLotes<TurnoJoin>(rows.map(r => r.id), async lote => {
    const { data } = await supabase
      .from('horarios_funcionarios')
      .select('funcionario_id, turnos_postos!turno_id(*)')
      .in('funcionario_id', lote)
      .is('data_fim', null)
    return (data ?? []) as TurnoJoin[]
  })
  const turnoPorFunc = new Map<string, TurnoRow & { nome: string }>()
  for (const h of horarios) if (h.turnos_postos) turnoPorFunc.set(h.funcionario_id, h.turnos_postos)

  const postoIds = Array.from(new Set(rows.map(r => r.posto_id).filter((p): p is string => !!p)))
  const escalas = await emLotes<{ posto_id: string; regime: string }>(postoIds, async lote => {
    const { data } = await supabase.from('config_escalas_postos').select('posto_id, regime').in('posto_id', lote)
    return (data ?? []) as { posto_id: string; regime: string }[]
  })
  const regimePosto = new Map(escalas.map(e => [e.posto_id, e.regime]))

  return rows.map(r => {
    const turno = turnoPorFunc.get(r.id) ?? null
    const funcao = r.funcoes?.nome ?? null
    const jovem = (funcao ?? '').toUpperCase() === FUNCAO_JOVEM_APRENDIZ
    const regime = jovem
      ? 'jovem_aprendiz'
      : turno?.tipo_escala ?? resolverTipoEscala(r.posto_id ? regimePosto.get(r.posto_id) : null)
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

  const { error } = await (createAdminClient() as AnyClient)
    .from('acordos_compensacao')
    .update({
      titulo: dados.titulo,
      data_documento: dados.data_documento,
      descricao_acordo: dados.descricao_acordo,
      subtipo: dados.subtipo ?? null,
    })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/acordos')
  return {}
}
