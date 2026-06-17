'use server'

import { createClient } from '@/lib/supabase/server'
import { addBusinessDays } from '@/lib/utils'
import { calcularKPIsAtuais } from '@/lib/dashboard-kpis'
import { FUNCOES_FORA_DO_EFETIVO } from '@/lib/constants'
import { calcularStatusExperiencia } from '@/lib/experiencia'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type KPIDashboard = {
  totalAtivos: number
  afastados: number
  emFerias: number
  coberturasAtivas: number
  solicitacoesPendentes: number
  deficit: number
  postosCriticos: number
  feriasTerminando30dias: number
}

export type PostoDeficit = {
  id: string
  nome: string
  secretaria: string | null
  gap: number
}

export type CatAlerta = {
  id: string
  funcionarioNome: string
  prazoLimite: string
  emAtraso: boolean
}

export type AlertasDashboard = {
  postosDeficit: PostoDeficit[]
  funcSemPosto: number
  feriasLimiteVencendo: number
  catAlertas: CatAlerta[]
}

export type ProximaFerias = {
  id: string
  funcionarioNome: string
  postoNome: string | null
  secretaria: string | null
  dataInicio: string
  status: string
}

export type AtestadoRecente = {
  id: string
  funcionarioNome: string
  postoNome: string | null
  supervisorNome: string | null
  secretaria: string | null
  dataInicio: string
  dataFim: string
  duracao: number
}

export type MesEfetivo = {
  mes: string
  label: string
  total: number
}

export type EvolucaoEfetivoResult = {
  meses: MesEfetivo[]
  apenasUmMes: boolean
  totalAtual: number
  primeiroCadastro: string | null
}

export type SecretariaRow = {
  nome: string
  previsto: number
  real: number
  pct: number
}

export type SolicitacaoPendenteRow = {
  id: string
  tipo: string
  created_at: string | null
  funcionarioNome: string
  supervisorNome: string | null
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function todayPlusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function currentDateStr(): string {
  return new Date().toISOString().split('T')[0]
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function buscarKPIsDashboard(): Promise<KPIDashboard> {
  const supabase = createClient()
  const kpis = await calcularKPIsAtuais(supabase)
  return {
    totalAtivos: kpis.ativos,
    afastados: kpis.afastados,
    emFerias: kpis.em_ferias,
    coberturasAtivas: kpis.coberturas_ativas,
    solicitacoesPendentes: kpis.aprovacoes_pendentes,
    deficit: kpis.postos_deficit,
    postosCriticos: kpis.postosCriticos,
    feriasTerminando30dias: kpis.feriasTerminando30dias,
  }
}

export async function buscarAlertasDashboard(): Promise<AlertasDashboard> {
  const supabase = createClient()

  const todayStr = currentDateStr()
  const plus30str = todayPlusDays(30)

  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0]

  const [
    { data: postosData },
    { data: funcAtivosData },
    { count: funcSemPosto },
    { count: feriasLimiteVencendo },
    { data: catData },
  ] = await Promise.all([
    supabase.from('postos').select('id, nome, secretaria, efetivo_previsto').eq('ativo', true),
    supabase.from('funcionarios').select('posto_id').eq('status', 'ativo').not('posto_id', 'is', null),
    supabase
      .from('funcionarios')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ativo')
      .is('posto_id', null),
    supabase
      .from('ferias')
      .select('*', { count: 'exact', head: true })
      .not('limite_gozo', 'is', null)
      .gte('limite_gozo', todayStr)
      .lte('limite_gozo', plus30str)
      .neq('status', 'concluido')
      .neq('status', 'cancelado')
      .neq('status', 'em_curso'),
    supabase
      .from('atestados')
      .select('id, data_inicio, funcionarios!funcionario_id(nome)')
      .eq('origem_ocupacional', 'acidente_trabalho')
      .gte('data_inicio', thirtyDaysAgoStr)
      .order('data_inicio', { ascending: false }),
  ])

  // Calcular gap por posto
  const funcPorPosto: Record<string, number> = {}
  for (const f of funcAtivosData ?? []) {
    const pid = f.posto_id as string
    funcPorPosto[pid] = (funcPorPosto[pid] ?? 0) + 1
  }

  const postosDeficit: PostoDeficit[] = (postosData ?? [])
    .map(p => ({
      id: p.id,
      nome: p.nome,
      secretaria: p.secretaria as string | null,
      gap: (p.efetivo_previsto ?? 0) - (funcPorPosto[p.id] ?? 0),
    }))
    .filter(p => p.gap > 0)
    .sort((a, b) => b.gap - a.gap)

  type CatRow = { id: string; data_inicio: string; funcionarios: { nome: string } | null }
  const hoje = new Date()
  function fmtDDMM(d: Date) {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const catAlertas: CatAlerta[] = ((catData ?? []) as unknown as CatRow[]).map(c => {
    const inicio = new Date(c.data_inicio + 'T00:00:00')
    const prazo = addBusinessDays(inicio, 1)
    return {
      id: c.id,
      funcionarioNome: c.funcionarios?.nome ?? '—',
      prazoLimite: fmtDDMM(prazo),
      emAtraso: hoje > prazo,
    }
  })

  return {
    postosDeficit,
    funcSemPosto: funcSemPosto ?? 0,
    feriasLimiteVencendo: feriasLimiteVencendo ?? 0,
    catAlertas,
  }
}

export async function buscarProximasFerias(dias = 7): Promise<ProximaFerias[]> {
  try {
    const supabase = createClient()
    const todayStr = currentDateStr()
    const plusDiasStr = todayPlusDays(dias)

    // 1. Buscar férias com join de funcionarios
    const { data: feriasData, error } = await supabase
      .from('ferias')
      .select('id, data_inicio, status, funcionarios!funcionario_id(id, nome, posto_id)')
      .in('status', ['agendado', 'aprovado'])
      .gte('data_inicio', todayStr)
      .lte('data_inicio', plusDiasStr)
      .order('data_inicio', { ascending: true })

    if (error || !feriasData) return []

    // 2. Coletar posto_ids únicos
    type FuncRow = { id: string; nome: string; posto_id: string | null }
    type FeriasRow = { id: string; data_inicio: string; status: string; funcionarios: FuncRow | null }

    const rows = feriasData as unknown as FeriasRow[]
    const postoIds = Array.from(new Set(rows.map(r => r.funcionarios?.posto_id).filter(Boolean))) as string[]

    // 3. Buscar postos
    const postoMap = new Map<string, { nome: string; secretaria: string | null }>()
    if (postoIds.length > 0) {
      const { data: postosData } = await supabase
        .from('postos')
        .select('id, nome, secretaria')
        .in('id', postoIds)
      for (const p of postosData ?? []) {
        postoMap.set(p.id, { nome: p.nome, secretaria: p.secretaria as string | null })
      }
    }

    return rows.map(r => {
      const posto = r.funcionarios?.posto_id ? postoMap.get(r.funcionarios.posto_id) : undefined
      return {
        id: r.id,
        funcionarioNome: r.funcionarios?.nome ?? '—',
        postoNome: posto?.nome ?? null,
        secretaria: posto?.secretaria ?? null,
        dataInicio: r.data_inicio,
        status: r.status,
      }
    })
  } catch {
    return []
  }
}

export async function buscarAtestadosRecentes(dias = 7): Promise<AtestadoRecente[]> {
  try {
    const supabase = createClient()
    const todayStr = currentDateStr()
    const diasAtrasStr = new Date(Date.now() - dias * 86_400_000).toISOString().split('T')[0]

    // 1. Buscar atestados recentes com joins
    const { data: atestadosData, error } = await supabase
      .from('atestados')
      .select('id, data_inicio, data_fim, posto_id, funcionarios!funcionario_id(nome), postos!posto_id(nome, secretaria)')
      .gte('data_inicio', diasAtrasStr)
      .lte('data_inicio', todayStr)
      .order('data_inicio', { ascending: false })

    if (error || !atestadosData) return []

    type AtestadoRow = {
      id: string
      data_inicio: string
      data_fim: string
      posto_id: string | null
      funcionarios: { nome: string } | null
      postos: { nome: string; secretaria: string | null } | null
    }

    const rows = atestadosData as unknown as AtestadoRow[]

    // 2. Buscar supervisores por posto
    const postoIds = Array.from(new Set(rows.map(r => r.posto_id).filter(Boolean))) as string[]
    const supervisorPorPosto = new Map<string, string>()

    if (postoIds.length > 0) {
      const { data: supData } = await supabase
        .from('config_supervisores_postos')
        .select('posto_id, perfis!config_supervisores_postos_supervisor_id_fkey(nome)')
        .in('posto_id', postoIds)
        .eq('ativo', true)

      type SupRow = { posto_id: string; perfis: { nome: string } | null }
      for (const s of (supData as unknown as SupRow[]) ?? []) {
        if (s.perfis?.nome && !supervisorPorPosto.has(s.posto_id)) {
          supervisorPorPosto.set(s.posto_id, s.perfis.nome)
        }
      }
    }

    return rows.map(r => {
      const duracao =
        Math.ceil(
          (new Date(r.data_fim).getTime() - new Date(r.data_inicio).getTime()) / 86_400_000
        ) + 1
      return {
        id: r.id,
        funcionarioNome: r.funcionarios?.nome ?? '—',
        postoNome: r.postos?.nome ?? null,
        supervisorNome: r.posto_id ? (supervisorPorPosto.get(r.posto_id) ?? null) : null,
        secretaria: r.postos?.secretaria ?? null,
        dataInicio: r.data_inicio,
        dataFim: r.data_fim,
        duracao,
      }
    })
  } catch {
    return []
  }
}

export async function buscarEvolucaoEfetivo(): Promise<EvolucaoEfetivoResult> {
  const supabase = createClient()

  const now = new Date()
  const sixMonthsAgo = new Date(now)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  sixMonthsAgo.setDate(1)
  const sixMonthsAgoStr = sixMonthsAgo.toISOString()

  const MONTH_LABELS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

  const [
    { count: totalAtual },
    { data: admissaoData },
    { data: primeiroCadastroData },
  ] = await Promise.all([
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase
      .from('funcionarios')
      .select('created_at')
      .gte('created_at', sixMonthsAgoStr),
    supabase
      .from('funcionarios')
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(1),
  ])

  // Construir array de 6 meses
  const meses: MesEfetivo[] = []
  const counts: Record<string, number> = {}

  for (const row of admissaoData ?? []) {
    const d = new Date(row.created_at as string)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    counts[key] = (counts[key] ?? 0) + 1
  }

  // Gerar os últimos 6 meses em ordem
  const runningTotal = totalAtual ?? 0
  // Trabalhar de trás para frente: o mês atual tem totalAtual como base
  // e subtrair os admitidos em meses anteriores é complexo sem data_desligamento
  // Usaremos a contagem de criados por mês como proxy de evolução (novos no período)
  const monthKeys: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now)
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${MONTH_LABELS_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`
    monthKeys.push(key)
    meses.push({ mes: key, label, total: counts[key] ?? 0 })
  }
  // O último mês (atual) deve mostrar o total atual de ativos
  if (meses.length > 0) {
    meses[meses.length - 1].total = runningTotal
  }

  const monthsWithData = meses.filter(m => m.total > 0).length
  const apenasUmMes = monthsWithData <= 1

  const primeiroCadastro =
    primeiroCadastroData?.[0]?.created_at
      ? (primeiroCadastroData[0].created_at as string).split('T')[0]
      : null

  return {
    meses,
    apenasUmMes,
    totalAtual: totalAtual ?? 0,
    primeiroCadastro,
  }
}

export async function buscarSecretariaData(): Promise<SecretariaRow[]> {
  const supabase = createClient()

  const [{ data: postosData }, { data: funcAtivosData }] = await Promise.all([
    supabase
      .from('postos')
      .select('id, nome, secretaria, efetivo_previsto')
      .eq('ativo', true)
      .not('secretaria', 'is', null),
    supabase.from('funcionarios').select('posto_id').eq('status', 'ativo').not('posto_id', 'is', null),
  ])

  const postoById = new Map<string, { secretaria: string | null }>(
    (postosData ?? []).map(p => [p.id, { secretaria: p.secretaria as string | null }])
  )

  const secAgg = new Map<string, { previsto: number; real: number }>()
  for (const p of postosData ?? []) {
    if (!p.secretaria) continue
    const agg = secAgg.get(p.secretaria as string) ?? { previsto: 0, real: 0 }
    agg.previsto += p.efetivo_previsto ?? 0
    secAgg.set(p.secretaria as string, agg)
  }
  for (const f of funcAtivosData ?? []) {
    const pid = f.posto_id as string
    const posto = postoById.get(pid)
    if (!posto?.secretaria) continue
    const agg = secAgg.get(posto.secretaria) ?? { previsto: 0, real: 0 }
    agg.real += 1
    secAgg.set(posto.secretaria, agg)
  }

  return Array.from(secAgg.entries())
    .map(([nome, { previsto, real }]) => {
      const pct = previsto > 0 ? Math.min(100, Math.round((real / previsto) * 100)) : 0
      return { nome, previsto, real, pct }
    })
    .sort((a, b) => a.pct - b.pct)
}

export async function buscarAprovacoesData(): Promise<SolicitacaoPendenteRow[]> {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('solicitacoes')
      .select('id, tipo, created_at, dados_depois, funcionarios!funcionario_id(nome), perfis!supervisor_id(nome)')
      .eq('status', 'pendente')
      .order('created_at', { ascending: true })
      .limit(5)

    if (error || !data) return []

    type SolRow = {
      id: string
      tipo: string
      created_at: string | null
      dados_depois: { nome?: string } | null
      funcionarios: { nome: string } | null
      perfis: { nome: string | null } | null
    }

    return (data as unknown as SolRow[]).map(s => ({
      id: s.id,
      tipo: s.tipo,
      created_at: s.created_at,
      funcionarioNome: s.tipo === 'admissao'
        ? (s.dados_depois?.nome ?? '—')
        : (s.funcionarios?.nome ?? '—'),
      supervisorNome: s.perfis?.nome ?? null,
    }))
  } catch {
    return []
  }
}

export type DeltaKPIs = {
  ativos: number | null
  afastados: number | null
  emFerias: number | null
  historico: { data: string; ativos: number; afastados: number; em_ferias: number }[]
}

export async function buscarDeltaKPIs(): Promise<DeltaKPIs> {
  const supabase = createClient()
  const { data } = await supabase
    .from('snapshots_diarios')
    .select('data, ativos, afastados, em_ferias')
    .order('data', { ascending: true })
    .limit(30)

  if (!data || data.length === 0) return { ativos: null, afastados: null, emFerias: null, historico: [] }

  const historico = data
  const ultimo = data[data.length - 1]
  const penultimo = data.length >= 2 ? data[data.length - 2] : null

  return {
    ativos:    penultimo ? ultimo.ativos    - penultimo.ativos    : null,
    afastados: penultimo ? ultimo.afastados - penultimo.afastados : null,
    emFerias:  penultimo ? ultimo.em_ferias - penultimo.em_ferias : null,
    historico,
  }
}

export async function buscarForaDoEfetivo(): Promise<number> {
  const supabase = createClient()
  const { data: funcoesRaw } = await supabase
    .from('funcoes')
    .select('id')
    .in('nome', [...FUNCOES_FORA_DO_EFETIVO])
  const ids = (funcoesRaw ?? []).map(f => f.id)
  if (ids.length === 0) return 0
  const { count } = await supabase
    .from('funcionarios')
    .select('*', { count: 'exact', head: true })
    .in('status', ['ativo', 'afastado', 'ferias'])
    .in('funcao_id', ids)
  return count ?? 0
}

export async function buscarExperienciasDashboard(): Promise<{ total: number; vencendo7dias: number }> {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('funcionarios')
      .select('data_admissao, periodo_experiencia')
      .not('periodo_experiencia', 'is', null)
      .in('status', ['ativo', 'afastado', 'ferias'])
      .range(0, 999)

    if (!data) return { total: 0, vencendo7dias: 0 }

    let total = 0
    let vencendo7dias = 0
    for (const f of data) {
      const exp = calcularStatusExperiencia(
        f.data_admissao as string | null,
        f.periodo_experiencia as '30+30' | '45+45' | null,
      )
      if (exp.emExperiencia) {
        total++
        if (exp.alertaCritico) vencendo7dias++
      }
    }
    return { total, vencendo7dias }
  } catch {
    return { total: 0, vencendo7dias: 0 }
  }
}

export async function buscarDeltaEfetivo(): Promise<{ ativos: number | null; afastados: number | null; em_ferias: number | null } | null> {
  try {
    const supabase = createClient()
    const ontem = new Date()
    ontem.setDate(ontem.getDate() - 1)
    const ontemStr = ontem.toISOString().split('T')[0]
    const { data } = await supabase
      .from('snapshots_diarios')
      .select('ativos, afastados, em_ferias')
      .eq('data', ontemStr)
      .single()
    return data ?? null
  } catch {
    return null
  }
}

export async function buscarOcorrenciasMes(dias = 30): Promise<number> {
  try {
    const supabase = createClient()
    const desde = new Date(Date.now() - dias * 86_400_000).toISOString().split('T')[0]
    const { count } = await supabase
      .from('ocorrencias')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', desde)
    return count ?? 0
  } catch {
    return 0
  }
}
