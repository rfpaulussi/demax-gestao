'use server'

import { createClient } from '@/lib/supabase/server'

// ─── Shared types ─────────────────────────────────────────────

export interface ImportResult {
  imported: number
  errors: string[]
}

export interface EventoHistoricoInput {
  matricula: string
  tipo: string
  data_evento: string
  descricao?: string
  dados_anteriores?: Record<string, unknown>
  dados_novos?: Record<string, unknown>
}

export interface CoberturaCsvRow {
  supervisor: string
  posto: string
  colaborador_cobriu: string
  data_cobertura: string
  periodo_dias: string
  agente_fixo_ausente: string
  motivo_cobertura: string
}

export interface MudancaFuncaoRow {
  data: string
  registro: string
  nome: string
  supervisor: string
  funcao_anterior: string
  nova_funcao: string
  posto_atual: string
  posto_novo: string
}

export interface AdvertenciaRow {
  registro: string
  nome: string
  posto: string
  data_fato: string
  hora_fato: string
  natureza: string
  descricao: string
  evidencias: string
  testemunhas: string
  defesa: string
  nivel_sugerido: string
  nivel_final: string
  medida_final: string
  dias_suspensao: string
  autor: string
  status_adv: string
  link_pdf: string
}

export interface EfetivoRow {
  registro: string
  nome: string
  cargo: string
  status: 'ativo' | 'afastado' | 'desligado'
  data_admissao: string | null
  data_desligamento: string | null
  periodo_experiencia: '30+30' | '45+45' | null
}

export interface FeriasImportRow {
  funcionario_id: string
  numero_periodo: number
  periodo_inicio: string
  periodo_fim: string | null
  limite_gozo: string | null
  dias_direito: number
  data_inicio: string | null
  data_fim: string | null
  dias_utilizados: number | null
  status: 'concluido' | 'agendado' | 'disponivel' | 'vencido'
  observacao: string
}

// ─── Helpers ──────────────────────────────────────────────────

function parseBRDate(s: string): string | null {
  const clean = (s ?? '').trim()
  if (!clean) return null
  const m = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

// historico_funcionarios was created after Supabase type generation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

function normalizeGrau(s: string): string {
  const l = (s ?? '').toLowerCase()
  if (l.includes('suspens')) return 'suspensao'
  if (l.includes('escrit')) return 'escrita'
  return 'verbal'
}

// ─── Action 1: Alocações → historico_funcionarios ─────────────

export async function importarEventosHistorico(
  eventos: EventoHistoricoInput[],
): Promise<ImportResult> {
  const supabase = createClient()
  const errors: string[] = []

  if (eventos.length === 0) return { imported: 0, errors: [] }

  const matriculas = Array.from(new Set(eventos.map(e => e.matricula).filter(Boolean)))
  const { data: funcsRaw1 } = await supabase
    .from('funcionarios')
    .select('id, registro')
    .in('registro', matriculas)
  const funcs1 = (funcsRaw1 ?? []) as unknown as { id: string; registro: string | null }[]

  const funcMap = new Map<string, string>()
  for (const f of funcs1) {
    if (f.registro) funcMap.set(String(f.registro), f.id)
  }

  const toInsert: Record<string, unknown>[] = []
  for (const ev of eventos) {
    const funcionario_id = funcMap.get(ev.matricula)
    if (!funcionario_id) {
      errors.push(`Matrícula "${ev.matricula}" não encontrada`)
      continue
    }
    toInsert.push({
      funcionario_id,
      tipo:             ev.tipo,
      data_evento:      ev.data_evento,
      descricao:        ev.descricao ?? null,
      dados_anteriores: ev.dados_anteriores ?? null,
      dados_novos:      ev.dados_novos ?? null,
    })
  }

  if (toInsert.length === 0) return { imported: 0, errors }

  const { error } = await (supabase as AnyClient).from('historico_funcionarios').insert(toInsert)
  if (!error) return { imported: toInsert.length, errors }

  // Fallback: individual inserts to surface specific failures
  let imported = 0
  for (const rec of toInsert) {
    const { error: e } = await (supabase as AnyClient).from('historico_funcionarios').insert(rec)
    if (e) errors.push(`${rec.tipo} [${rec.funcionario_id}]: ${e.message}`)
    else imported++
  }
  return { imported, errors }
}

// ─── Action 2: Coberturas Insalubres ──────────────────────────

export async function importarCoberturas(
  rows: CoberturaCsvRow[],
): Promise<ImportResult> {
  const supabase = createClient()
  const errors: string[] = []

  if (rows.length === 0) return { imported: 0, errors: [] }

  const nomesFuncs   = Array.from(new Set(rows.map(r => r.colaborador_cobriu).filter(Boolean)))
  const nomesPostos  = Array.from(new Set(rows.map(r => r.posto).filter(Boolean)))
  const nomesAusentes = Array.from(new Set(rows.map(r => r.agente_fixo_ausente).filter(Boolean)))

  const [{ data: funcs }, { data: postos }, { data: ausentes }] = await Promise.all([
    supabase.from('funcionarios').select('id, nome').in('nome', nomesFuncs),
    supabase.from('postos').select('id, nome').in('nome', nomesPostos),
    supabase.from('funcionarios').select('id, nome').in('nome', nomesAusentes),
  ])

  const funcMap    = new Map((funcs    ?? []).map(f => [f.nome.trim().toLowerCase(), f.id]))
  const postoMap   = new Map((postos   ?? []).map(p => [p.nome.trim().toLowerCase(), p.id]))
  const ausenteMap = new Map((ausentes ?? []).map(f => [f.nome.trim().toLowerCase(), f.id]))

  const toInsert: Record<string, unknown>[] = []
  for (const row of rows) {
    const funcionario_id = funcMap.get(row.colaborador_cobriu.trim().toLowerCase())
    if (!funcionario_id) {
      errors.push(`Colaborador "${row.colaborador_cobriu}" não encontrado`)
      continue
    }
    const dataCobertura = parseBRDate(row.data_cobertura)
    if (!dataCobertura) {
      errors.push(`Data inválida "${row.data_cobertura}" para "${row.colaborador_cobriu}"`)
      continue
    }
    const [yyyy, mm] = dataCobertura.split('-')
    toInsert.push({
      funcionario_id,
      posto_id:            postoMap.get(row.posto.trim().toLowerCase()) ?? null,
      agente_ausente_id:   ausenteMap.get(row.agente_fixo_ausente.trim().toLowerCase()) ?? null,
      agente_ausente_nome: row.agente_fixo_ausente || null,
      data_cobertura:      dataCobertura,
      mes:                 parseInt(mm),
      ano:                 parseInt(yyyy),
      origem:              'manual',
      observacao:          row.motivo_cobertura || null,
      status:              'pendente',
    })
  }

  if (toInsert.length === 0) return { imported: 0, errors }

  const { error: insertErr } = await (supabase as AnyClient)
    .from('insalubridade_coberturas')
    .insert(toInsert)

  if (!insertErr) return { imported: toInsert.length, errors }

  let imported = 0
  for (const rec of toInsert) {
    const { error: e } = await (supabase as AnyClient).from('insalubridade_coberturas').insert(rec)
    if (e && !e.message.includes('duplicate') && !e.message.includes('unique'))
      errors.push(`${rec['data_cobertura']}: ${e.message}`)
    else imported++
  }
  return { imported, errors }
}

// ─── Action 3: Mudanças de Função ─────────────────────────────

export async function importarMudancasFuncao(
  rows: MudancaFuncaoRow[],
): Promise<ImportResult> {
  const supabase = createClient()
  const errors: string[] = []

  if (rows.length === 0) return { imported: 0, errors: [] }

  const matriculas = Array.from(new Set(rows.map(r => r.registro).filter(Boolean)))
  const { data: funcsRaw2 } = await supabase
    .from('funcionarios')
    .select('id, registro')
    .in('registro', matriculas)
  const funcs2 = (funcsRaw2 ?? []) as unknown as { id: string; registro: string | null }[]
  const funcMap = new Map(funcs2.map(f => [String(f.registro), f.id]))

  const toInsert: Record<string, unknown>[] = []
  for (const row of rows) {
    const funcionario_id = funcMap.get(row.registro)
    if (!funcionario_id) { errors.push(`Matrícula "${row.registro}" não encontrada`); continue }
    const dataEvento = parseBRDate(row.data) ?? new Date().toISOString().split('T')[0]
    toInsert.push({
      funcionario_id,
      tipo:             'mudanca_funcao',
      data_evento:      dataEvento,
      descricao:        `Função: ${row.funcao_anterior} → ${row.nova_funcao}`,
      dados_anteriores: { funcao: row.funcao_anterior, posto: row.posto_atual },
      dados_novos:      { funcao: row.nova_funcao, posto: row.posto_novo },
    })
  }

  if (toInsert.length === 0) return { imported: 0, errors }

  const { error } = await (supabase as AnyClient).from('historico_funcionarios').insert(toInsert)
  if (!error) return { imported: toInsert.length, errors }

  let imported = 0
  for (const rec of toInsert) {
    const { error: e } = await (supabase as AnyClient).from('historico_funcionarios').insert(rec)
    if (e) errors.push(`${rec.descricao}: ${e.message}`)
    else imported++
  }
  return { imported, errors }
}

// ─── Action 4: Advertências ───────────────────────────────────

export async function importarAdvertencias(
  rows: AdvertenciaRow[],
): Promise<ImportResult> {
  const supabase = createClient()
  const errors: string[] = []

  if (rows.length === 0) return { imported: 0, errors: [] }

  const matriculas  = Array.from(new Set(rows.map(r => r.registro).filter(Boolean)))
  const { data: funcsRaw } = await supabase
    .from('funcionarios').select('id, registro').in('registro', matriculas)
  const funcs = (funcsRaw ?? []) as unknown as { id: string; registro: string | null }[]

  const funcMap = new Map(funcs.map(f => [String(f.registro), f.id]))

  const toInsert: Record<string, unknown>[] = []
  for (const row of rows) {
    const funcionario_id = funcMap.get(row.registro)
    if (!funcionario_id) { errors.push(`Matrícula "${row.registro}" não encontrada`); continue }

    const dataOcorrencia = parseBRDate(row.data_fato)
    if (!dataOcorrencia) { errors.push(`Data inválida "${row.data_fato}" (mat. ${row.registro})`); continue }

    const grau = normalizeGrau(row.nivel_final || row.nivel_sugerido)
    toInsert.push({
      funcionario_id,
      grau,
      tipo:                grau,
      descricao:           row.descricao || null,
      data_ocorrencia:     dataOcorrencia,
      horario_fato:        row.hora_fato || null,
      natureza:            row.natureza || null,
      relato:              row.descricao || null,
      testemunha_1:        row.testemunhas || null,
      defesa_colaborador:  row.defesa || null,
      dias_suspensao:      row.dias_suspensao ? parseInt(row.dias_suspensao) || null : null,
      pdf_url:             row.link_pdf || null,
      status:              'gerada',
    })
  }

  if (toInsert.length === 0) return { imported: 0, errors }

  const { error } = await (supabase as AnyClient).from('advertencias').insert(toInsert)
  if (!error) return { imported: toInsert.length, errors }

  let imported = 0
  for (const rec of toInsert) {
    const { error: e } = await (supabase as AnyClient).from('advertencias').insert(rec)
    if (e) errors.push(`Mat. ${rec.funcionario_id}: ${e.message}`)
    else imported++
  }
  return { imported, errors }
}

// ─── Action 5: Efetivo ────────────────────────────────────────

export async function importarEfetivo(rows: EfetivoRow[]): Promise<ImportResult> {
  const supabase = createClient()
  let imported = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      let funcao_id: string | null = null
      if (row.cargo) {
        const { data: funcaoExistente } = await supabase
          .from('funcoes')
          .select('id')
          .ilike('nome', row.cargo.trim())
          .maybeSingle()

        if (funcaoExistente) {
          funcao_id = funcaoExistente.id
        } else {
          const { data: novaFuncao } = await supabase
            .from('funcoes')
            .insert({ nome: row.cargo.trim(), insalubridade_perc: 0, periculosidade_perc: 0, salario_base: 0, insalubridade_valor: 0, periculosidade_valor: 0 })
            .select('id')
            .single()
          if (novaFuncao) funcao_id = novaFuncao.id
        }
      }

      const { error } = await supabase
        .from('funcionarios')
        .upsert({
          registro: row.registro,
          nome: row.nome,
          funcao_id,
          status: row.status,
          data_admissao: row.data_admissao,
          data_desligamento: row.data_desligamento,
          periodo_experiencia: row.periodo_experiencia,
        }, { onConflict: 'registro' })

      if (error) errors.push(`${row.registro} — ${error.message}`)
      else imported++
    } catch {
      errors.push(`${row.registro} — erro inesperado`)
    }
  }

  return { imported, errors }
}

// ─── Action 5: Férias históricas bulk ─────────────────────────

export async function importarFeriasHistoricasBulk(rows: FeriasImportRow[]): Promise<ImportResult> {
  const supabase = createClient()
  const { error } = await (supabase as AnyClient)
    .from('ferias')
    .upsert(rows, { onConflict: 'funcionario_id,numero_periodo' })
  if (error) return { imported: 0, errors: [error.message] }
  return { imported: rows.length, errors: [] }
}
