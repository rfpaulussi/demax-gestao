'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { getUser } from '@/lib/auth/get-user'
import { feriadosDoAno, diasUteisNoPeriodo, toDate } from '@/lib/utils/dias-uteis'

const DIAS_COBERTURA_ATESTADO = 15

export interface FechamentoFinanceiro {
  funcionario_id: string
  funcionario_nome: string
  registro: string | null
  funcao: string | null
  posto_nome: string | null
  secretaria: string | null
  regime: string
  dias_uteis: number
  dias_trabalhados: number
  salario_bruto: number
  salario_prop: number
  custo_total: number | null
  custo_prop: number | null
  sem_custo: boolean
}

function clipToMes(date: string | null, fallback: string, mesStart: string, mesEnd: string): string {
  const d = date ?? fallback
  if (d < mesStart) return mesStart
  if (d > mesEnd) return mesEnd
  return d
}

export async function calcularFechamentoFinanceiro(mes: number, ano: number): Promise<FechamentoFinanceiro[]> {
  const userCtx = await getUser()
  if (!userCtx || !['admin', 'coordenador'].includes(userCtx.perfil.role ?? '')) {
    throw new Error('Acesso negado')
  }

  const supabase = createClient()

  const mesStr      = String(mes).padStart(2, '0')
  const daysInMonth = new Date(ano, mes, 0).getDate()
  const mesStartStr = `${ano}-${mesStr}-01`
  const mesEndStr   = `${ano}-${mesStr}-${String(daysInMonth).padStart(2, '0')}`
  const mesStart    = new Date(mesStartStr + 'T12:00:00')
  const mesEnd      = new Date(mesEndStr   + 'T12:00:00')

  // 1. Funcionários com campos financeiros
  const funcionariosRaw = await fetchAllRows((from, to) =>
    supabase
      .from('funcionarios')
      .select(`
        id, nome, registro, data_admissao, data_desligamento, posto_id,
        funcoes!funcionarios_funcao_id_fkey (
          nome, salario_base, insalubridade_valor, periculosidade_valor,
          custos_funcoes ( total_por_func )
        ),
        postos!posto_id ( nome, secretaria, config_escalas_postos ( regime ) )
      `)
      .lte('data_admissao', mesEndStr)
      .or(`data_desligamento.is.null,data_desligamento.gte.${mesStartStr}`)
      .order('id', { ascending: true })
      .range(from, to),
  )

  const funcionarios = funcionariosRaw.sort((a, b) =>
    (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR', { sensitivity: 'base' }),
  )

  if (funcionarios.length === 0) return []

  // 2. Busca paralela — mesmas queries de frequência do fechamento HR
  const [ferRes, atRes, falRes, advRes, afaRes, postoConfigRes] = await Promise.all([
    supabase
      .from('ferias')
      .select('funcionario_id, data_inicio, data_fim')
      .in('status', ['em_curso', 'concluido', 'aprovado'])
      .lte('data_inicio', mesEndStr)
      .gte('data_fim', mesStartStr),

    supabase
      .from('atestados')
      .select('funcionario_id, data_inicio, data_fim')
      .lte('data_inicio', mesEndStr)
      .gte('data_fim', mesStartStr),

    supabase
      .from('faltas')
      .select('funcionario_id, dias')
      .gte('data_falta', mesStartStr)
      .lte('data_falta', mesEndStr),

    supabase
      .from('advertencias')
      .select('funcionario_id, grau, dias_suspensao')
      .in('status', ['gerada', 'entregue'])
      .gte('data_ocorrencia', mesStartStr)
      .lte('data_ocorrencia', mesEndStr),

    supabase
      .from('afastamentos')
      .select('funcionario_id, data_inicio, data_fim_real')
      .lte('data_inicio', mesEndStr)
      .or(`data_fim_real.is.null,data_fim_real.gte.${mesStartStr}`),

    supabase.from('config_escalas_postos').select('posto_id, regime'),
  ])

  if (ferRes.error)        throw ferRes.error
  if (atRes.error)         throw atRes.error
  if (falRes.error)        throw falRes.error
  if (advRes.error)        throw advRes.error
  if (afaRes.error)        throw afaRes.error
  if (postoConfigRes.error) throw postoConfigRes.error

  const ferias       = ferRes.data  ?? []
  const atestados    = atRes.data   ?? []
  const faltas       = falRes.data  ?? []
  const advertencias = advRes.data  ?? []
  const afastamentos = afaRes.data  ?? []

  const postoConfigMap = new Map<string, string>()
  for (const pc of postoConfigRes.data ?? []) {
    postoConfigMap.set(pc.posto_id, pc.regime)
  }

  const feriados = feriadosDoAno(ano)

  type PostoJoin = { nome: string; secretaria: string | null; config_escalas_postos: { regime: string }[] | null } | null
  type CustosFuncoesJoin = { total_por_func: number | null } | { total_por_func: number | null }[] | null
  type FuncaoJoin = {
    nome: string
    salario_base: number | null
    insalubridade_valor: number | null
    periculosidade_valor: number | null
    custos_funcoes: CustosFuncoesJoin
  } | null

  return funcionarios.map(func => {
    const admissao     = func.data_admissao     ? new Date(func.data_admissao     + 'T12:00:00') : mesStart
    const desligamento = func.data_desligamento ? new Date(func.data_desligamento + 'T12:00:00') : mesEnd

    const periodoInicio = new Date(Math.max(admissao.getTime(), mesStart.getTime()))
    const periodoFim    = new Date(Math.min(desligamento.getTime(), mesEnd.getTime()))

    const postos  = func.postos  as unknown as PostoJoin
    const funcoes = func.funcoes as unknown as FuncaoJoin
    const regime  = postos?.config_escalas_postos?.[0]?.regime ?? postoConfigMap.get(func.posto_id ?? '') ?? '5x2'

    const diasUteis = diasUteisNoPeriodo(periodoInicio, periodoFim, regime, feriados)

    const feriasDias = ferias
      .filter(f => f.funcionario_id === func.id)
      .reduce((acc, f) => {
        const s = clipToMes(f.data_inicio!, mesStartStr, mesStartStr, mesEndStr)
        const e = clipToMes(f.data_fim!, mesEndStr, mesStartStr, mesEndStr)
        return acc + diasUteisNoPeriodo(toDate(s), toDate(e), regime, feriados)
      }, 0)

    const atestadosDias = atestados
      .filter(a => a.funcionario_id === func.id)
      .reduce((acc, a) => {
        const fimCoberto = new Date(toDate(a.data_inicio).getTime() + (DIAS_COBERTURA_ATESTADO - 1) * 86400000)
          .toISOString().split('T')[0]
        const fimEfetivo = fimCoberto < a.data_fim ? fimCoberto : a.data_fim
        const s = clipToMes(a.data_inicio, mesStartStr, mesStartStr, mesEndStr)
        const e = clipToMes(fimEfetivo, mesEndStr, mesStartStr, mesEndStr)
        return acc + diasUteisNoPeriodo(toDate(s), toDate(e), regime, feriados)
      }, 0)

    const faltasDias = faltas
      .filter(f => f.funcionario_id === func.id)
      .reduce((acc, f) => acc + (f.dias ?? 1), 0)

    const suspensoes    = advertencias.filter(a => a.funcionario_id === func.id && a.grau === 'suspensao')
    const diasSuspensao = suspensoes.reduce((acc, a) => acc + (a.dias_suspensao ?? 0), 0)

    const afastamentoDias = afastamentos
      .filter(a => a.funcionario_id === func.id)
      .reduce((acc, a) => {
        const s = clipToMes(a.data_inicio, mesStartStr, mesStartStr, mesEndStr)
        const e = clipToMes(a.data_fim_real ?? mesEndStr, mesEndStr, mesStartStr, mesEndStr)
        return acc + diasUteisNoPeriodo(toDate(s), toDate(e), regime, feriados)
      }, 0)

    const diasTrabalhados = Math.max(
      0,
      diasUteis - feriasDias - faltasDias - atestadosDias - diasSuspensao - afastamentoDias,
    )

    // Cálculo financeiro
    const salarioBase  = funcoes?.salario_base       ?? 0
    const insalVal     = funcoes?.insalubridade_valor  ?? 0
    const periculVal   = funcoes?.periculosidade_valor ?? 0
    const salarioBruto = salarioBase + insalVal + periculVal

    // custos_funcoes pode vir como array (PostgREST) — normalizar
    const custosFuncoesRaw = funcoes?.custos_funcoes
    const custoTotal = Array.isArray(custosFuncoesRaw)
      ? (custosFuncoesRaw[0]?.total_por_func ?? null)
      : (custosFuncoesRaw?.total_por_func ?? null)

    const proporcao   = diasUteis > 0 ? diasTrabalhados / diasUteis : 0
    const salarioProp = Math.round(salarioBruto * proporcao * 100) / 100
    const custoProp   = custoTotal != null ? Math.round(custoTotal * proporcao * 100) / 100 : null

    return {
      funcionario_id:   func.id,
      funcionario_nome: func.nome ?? '',
      registro:         (func as { registro?: string | null }).registro ?? null,
      funcao:           funcoes?.nome ?? null,
      posto_nome:       postos?.nome  ?? null,
      secretaria:       postos?.secretaria ?? null,
      regime,
      dias_uteis:       diasUteis,
      dias_trabalhados: diasTrabalhados,
      salario_bruto:    salarioBruto,
      salario_prop:     salarioProp,
      custo_total:      custoTotal,
      custo_prop:       custoProp,
      sem_custo:        custoTotal == null || salarioBruto === 0,
    }
  })
}
