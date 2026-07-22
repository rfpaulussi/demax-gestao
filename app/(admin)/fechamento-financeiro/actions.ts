'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { getUser } from '@/lib/auth/get-user'
import { feriadosDoAno, diasUteisNoPeriodo, toDate } from '@/lib/utils/dias-uteis'

const DIAS_COBERTURA_ATESTADO = 15

export interface CustoFuncaoDetalhe {
  va: number | null
  vr: number | null
  vt: number | null
  enc_inss: number | null
  fgts: number | null
  assid_asseio: number | null
  bss: number | null
  aux_saude: number | null
  plr: number | null
  um_doze_decimo_terceiro: number | null
  um_terceiro_ferias: number | null
  enc_provisorio: number | null
  um_doze_lei_12506: number | null
  multa_40_pct: number | null
}

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
  custo_ferias_extra: number
  sem_custo: boolean
  is_afastado: boolean
  em_ferias: boolean
  dias_ferias: number
  // ── Memória de Cálculo — detalhamento adicional ──
  periodo_inicio: string
  periodo_fim: string
  dias_atestado: number
  dias_falta: number
  dias_suspensao: number
  dias_afastamento: number
  proporcao_paga: number
  bonus_terco_ferias: number
  proporcao_final: number
  salario_base: number
  insalubridade_valor: number
  insalubridade_perc: number | null
  periculosidade_valor: number
  periculosidade_perc: number | null
  custo_detalhe: CustoFuncaoDetalhe | null
}

function clipToMes(date: string | null, fallback: string, mesStart: string, mesEnd: string): string {
  const d = date ?? fallback
  if (d < mesStart) return mesStart
  if (d > mesEnd) return mesEnd
  return d
}

export async function calcularFechamentoFinanceiro(
  mes: number,
  ano: number,
  opcoes?: { excluirAprendiz?: boolean },
): Promise<FechamentoFinanceiro[]> {
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
          nome, salario_base,
          insalubridade_perc, insalubridade_valor,
          periculosidade_perc, periculosidade_valor,
          custos_funcoes (
            va, vr, vt, enc_inss, fgts, assid_asseio, bss, aux_saude, plr,
            um_doze_decimo_terceiro, um_terceiro_ferias, enc_provisorio,
            um_doze_lei_12506, multa_40_pct, total_por_func
          )
        ),
        postos!posto_id ( nome, secretaria, config_escalas_postos ( regime ) )
      `)
      .lte('data_admissao', mesEndStr)
      .or(`data_desligamento.is.null,data_desligamento.gte.${mesStartStr}`)
      .order('id', { ascending: true })
      .range(from, to),
  )

  let funcionarios = funcionariosRaw.sort((a, b) =>
    (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR', { sensitivity: 'base' }),
  )

  if (opcoes?.excluirAprendiz) {
    funcionarios = funcionarios.filter(f => {
      const funcNome = ((f.funcoes as unknown as { nome?: string } | null)?.nome ?? '').toUpperCase()
      return funcNome !== 'JOVEM APRENDIZ'
    })
  }

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
  type CustosFuncoesRow = CustoFuncaoDetalhe & { total_por_func: number | null }
  type CustosFuncoesJoin = CustosFuncoesRow[] | CustosFuncoesRow | null
  type FuncaoJoin = {
    nome: string
    salario_base: number | null
    insalubridade_perc: number | null
    insalubridade_valor: number | null
    periculosidade_perc: number | null
    periculosidade_valor: number | null
    custos_funcoes: CustosFuncoesJoin
  } | null

  return funcionarios.map(func => {
    const admissao     = func.data_admissao     ? new Date(func.data_admissao     + 'T12:00:00') : mesStart
    const desligamento = func.data_desligamento ? new Date(func.data_desligamento + 'T12:00:00') : mesEnd

    const periodoInicio = new Date(Math.max(admissao.getTime(), mesStart.getTime()))
    const periodoFim    = new Date(Math.min(desligamento.getTime(), mesEnd.getTime()))
    const periodoInicioStr = periodoInicio.toISOString().split('T')[0]
    const periodoFimStr    = periodoFim.toISOString().split('T')[0]

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
    const custosFuncoesObj = Array.isArray(custosFuncoesRaw)
      ? (custosFuncoesRaw[0] ?? null)
      : (custosFuncoesRaw ?? null)
    const custoTotal = custosFuncoesObj?.total_por_func ?? null
    const custoDetalhe: CustoFuncaoDetalhe | null = custosFuncoesObj ? {
      va: custosFuncoesObj.va,
      vr: custosFuncoesObj.vr,
      vt: custosFuncoesObj.vt,
      enc_inss: custosFuncoesObj.enc_inss,
      fgts: custosFuncoesObj.fgts,
      assid_asseio: custosFuncoesObj.assid_asseio,
      bss: custosFuncoesObj.bss,
      aux_saude: custosFuncoesObj.aux_saude,
      plr: custosFuncoesObj.plr,
      um_doze_decimo_terceiro: custosFuncoesObj.um_doze_decimo_terceiro,
      um_terceiro_ferias: custosFuncoesObj.um_terceiro_ferias,
      enc_provisorio: custosFuncoesObj.enc_provisorio,
      um_doze_lei_12506: custosFuncoesObj.um_doze_lei_12506,
      multa_40_pct: custosFuncoesObj.multa_40_pct,
    } : null

    // Funcionários no posto AFASTADOS não geram custo contratual
    const isAfastado = (postos?.secretaria ?? '').toUpperCase() === 'AFASTADOS'

    // Dias de férias são remunerados (a empresa paga normalmente) + terço constitucional
    const diasPagos     = diasTrabalhados + feriasDias
    const proporcaoPaga = (!isAfastado && diasUteis > 0) ? diasPagos / diasUteis : 0
    // Bônus do terço: 1/3 sobre a proporção dos dias de férias no mês
    const bonusTerco    = (!isAfastado && diasUteis > 0) ? (feriasDias / diasUteis) / 3 : 0
    const proporcao     = proporcaoPaga + bonusTerco

    const salarioProp      = Math.round(salarioBruto * proporcao * 100) / 100
    const custoProp        = (!isAfastado && custoTotal != null)
      ? Math.round(custoTotal * proporcao * 100) / 100
      : null
    const custoFeriasExtra = Math.round(salarioBruto * bonusTerco * 100) / 100

    return {
      funcionario_id:   func.id,
      funcionario_nome: func.nome ?? '',
      registro:         (func as { registro?: string | null }).registro ?? null,
      funcao:           funcoes?.nome ?? null,
      posto_nome:       postos?.nome  ?? null,
      secretaria:       postos?.secretaria ?? null,
      regime,
      dias_uteis:       diasUteis,
      dias_trabalhados: isAfastado ? 0 : diasTrabalhados,
      salario_bruto:    salarioBruto,
      salario_prop:     salarioProp,
      custo_total:       isAfastado ? null : custoTotal,
      custo_prop:        custoProp,
      custo_ferias_extra: isAfastado ? 0 : custoFeriasExtra,
      sem_custo:         !isAfastado && (custoTotal == null || salarioBruto === 0),
      is_afastado:       isAfastado,
      em_ferias:         feriasDias > 0,
      dias_ferias:       feriasDias,
      periodo_inicio:       periodoInicioStr,
      periodo_fim:          periodoFimStr,
      dias_atestado:        atestadosDias,
      dias_falta:           faltasDias,
      dias_suspensao:       diasSuspensao,
      dias_afastamento:     afastamentoDias,
      proporcao_paga:       proporcaoPaga,
      bonus_terco_ferias:   bonusTerco,
      proporcao_final:      proporcao,
      salario_base:         salarioBase,
      insalubridade_valor:  insalVal,
      insalubridade_perc:   funcoes?.insalubridade_perc ?? null,
      periculosidade_valor: periculVal,
      periculosidade_perc:  funcoes?.periculosidade_perc ?? null,
      custo_detalhe:        isAfastado ? null : custoDetalhe,
    }
  })
}

// ─── Histórico de fechamentos ─────────────────────────────────────────────────

const MESES_NOME = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export interface ResumoFechamento {
  id: string
  mes: number
  ano: number
  custo_total: number
  salario_total: number
  total_ativos: number
  total_afastados: number
  total_em_ferias: number
  total_dias_ferias: number
  custo_ferias_extra: number
  excluiu_aprendiz: boolean
  gerado_em: string
}

export async function salvarResumoFechamento(
  mes: number,
  ano: number,
  excluiuAprendiz: boolean,
): Promise<{ ok: boolean; message: string }> {
  const userCtx = await getUser()
  if (!userCtx || !['admin', 'coordenador'].includes(userCtx.perfil.role ?? '')) {
    return { ok: false, message: 'Acesso negado' }
  }

  const dados = await calcularFechamentoFinanceiro(mes, ano, { excluirAprendiz: excluiuAprendiz })
  const ativos    = dados.filter(d => !d.is_afastado)
  const afastados = dados.filter(d => d.is_afastado)

  const supabase = createClient()
  const { error } = await supabase
    .from('fechamento_financeiro_resumos')
    .upsert({
      mes,
      ano,
      custo_total:       Math.round(ativos.reduce((s, d) => s + (d.custo_prop ?? 0), 0) * 100) / 100,
      salario_total:     Math.round(ativos.reduce((s, d) => s + d.salario_prop, 0) * 100) / 100,
      total_ativos:      ativos.length,
      total_afastados:   afastados.length,
      total_em_ferias:   ativos.filter(d => d.em_ferias).length,
      total_dias_ferias: ativos.reduce((s, d) => s + d.dias_ferias, 0),
      custo_ferias_extra: Math.round(ativos.reduce((s, d) => s + d.custo_ferias_extra, 0) * 100) / 100,
      excluiu_aprendiz:  excluiuAprendiz,
      gerado_por:        userCtx.user.id,
      gerado_em:         new Date().toISOString(),
    }, { onConflict: 'mes,ano' })

  if (error) return { ok: false, message: `Erro: ${error.message}` }
  return { ok: true, message: `Fechamento de ${MESES_NOME[mes]}/${ano} salvo.` }
}

export async function listarResumosFechamento(): Promise<ResumoFechamento[]> {
  const userCtx = await getUser()
  if (!userCtx || !['admin', 'coordenador'].includes(userCtx.perfil.role ?? '')) return []

  const supabase = createClient()
  const { data } = await supabase
    .from('fechamento_financeiro_resumos')
    .select('*')
    .order('ano', { ascending: true })
    .order('mes', { ascending: true })
    .limit(24)

  return (data ?? []) as ResumoFechamento[]
}
