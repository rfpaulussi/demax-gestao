'use server'

import { createClient } from '@/lib/supabase/server'

export interface FechamentoFuncionario {
  funcionario_id: string
  funcionario_nome: string
  funcao: string | null
  posto_nome: string | null
  secretaria: string | null
  data_admissao: string | null
  data_desligamento: string | null
  // Período ativo no mês
  periodo_inicio: string
  periodo_fim: string
  dias_calendario: number
  regime: string
  // Dias úteis do período — 5×2: seg–sex; 5×1 e 12×36: todos os dias corridos
  dias_uteis: number
  // Deduções
  ferias_dias: number
  faltas_dias: number
  atestados_dias: number
  dias_suspensao: number
  // Resultado
  dias_trabalhados: number
  // Indicadores
  tem_advertencia: boolean
  tem_suspensao: boolean
  insalubridade_dias: number
}

// ─── helpers ────────────────────────────────────────────────────────────────

function diasUteisNoPeriodo(start: Date, end: Date, regime: string): number {
  if (regime === '5x1' || regime === '12x36') {
    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1)
  }
  // 5x2: seg–sex
  let count = 0
  const d = new Date(start)
  while (d <= end) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

function diasSobrepostos(
  aStart: string,
  aEnd: string,
  mesStartStr: string,
  mesEndStr: string,
): number {
  const s = new Date(Math.max(
    new Date(aStart  + 'T12:00:00').getTime(),
    new Date(mesStartStr + 'T12:00:00').getTime(),
  ))
  const e = new Date(Math.min(
    new Date(aEnd    + 'T12:00:00').getTime(),
    new Date(mesEndStr   + 'T12:00:00').getTime(),
  ))
  if (s > e) return 0
  return Math.floor((e.getTime() - s.getTime()) / 86400000) + 1
}

// ─── main function ───────────────────────────────────────────────────────────

export async function calcularFechamento(
  mes: number,
  ano: number,
): Promise<FechamentoFuncionario[]> {
  const supabase = createClient()

  const mesStr      = String(mes).padStart(2, '0')
  const daysInMonth = new Date(ano, mes, 0).getDate()
  const mesStartStr = `${ano}-${mesStr}-01`
  const mesEndStr   = `${ano}-${mesStr}-${String(daysInMonth).padStart(2, '0')}`
  const mesStart    = new Date(mesStartStr + 'T12:00:00')
  const mesEnd      = new Date(mesEndStr   + 'T12:00:00')

  // 1. Funcionários ativos em algum momento no mês
  const { data: funcs } = await supabase
    .from('funcionarios')
    .select(`
      id, nome, data_admissao, data_desligamento, status,
      funcoes!funcionarios_funcao_id_fkey ( nome ),
      postos!posto_id ( nome, secretaria, config_escalas_postos ( regime ) )
    `)
    .lte('data_admissao', mesEndStr)
    .or(`data_desligamento.is.null,data_desligamento.gte.${mesStartStr}`)
    .order('nome')
    .range(0, 1499)

  const funcionarios = funcs ?? []
  if (funcionarios.length === 0) return []

  // 2. Busca paralela de todos os eventos do mês
  const [ferRes, atRes, falRes, advRes, insRes] = await Promise.all([
    supabase
      .from('ferias')
      .select('funcionario_id, data_inicio, data_fim')
      .in('status', ['em_curso', 'concluido', 'aprovado'])
      .lte('data_inicio', mesEndStr)
      .gte('data_fim',    mesStartStr),

    supabase
      .from('atestados')
      .select('funcionario_id, data_inicio, data_fim')
      .lte('data_inicio', mesEndStr)
      .gte('data_fim',    mesStartStr),

    supabase
      .from('faltas')
      .select('funcionario_id, dias')
      .gte('data_falta', mesStartStr)
      .lte('data_falta', mesEndStr),

    supabase
      .from('advertencias')
      .select('funcionario_id, grau, dias_suspensao')
      .gte('data_ocorrencia', mesStartStr)
      .lte('data_ocorrencia', mesEndStr),

    supabase
      .from('insalubridade_coberturas')
      .select('funcionario_id')
      .eq('mes', mes)
      .eq('ano', ano),
  ])

  const ferias         = ferRes.data ?? []
  const atestados      = atRes.data  ?? []
  const faltas         = falRes.data ?? []
  const advertencias   = advRes.data ?? []
  const insalubridades = insRes.data ?? []

  // 3. Cálculo por funcionário
  return funcionarios.map(func => {
    const admissao     = func.data_admissao
      ? new Date(func.data_admissao + 'T12:00:00')
      : mesStart
    const desligamento = func.data_desligamento
      ? new Date(func.data_desligamento + 'T12:00:00')
      : mesEnd

    const periodoInicio = new Date(Math.max(admissao.getTime(), mesStart.getTime()))
    const periodoFim    = new Date(Math.min(desligamento.getTime(), mesEnd.getTime()))

    const diasCalendario = Math.max(
      0,
      Math.floor((periodoFim.getTime() - periodoInicio.getTime()) / 86400000) + 1,
    )

    const postos  = func.postos  as unknown as { nome: string; secretaria: string | null; config_escalas_postos: { regime: string }[] | null } | null
    const funcoes = func.funcoes as unknown as { nome: string } | null
    const regime  = postos?.config_escalas_postos?.[0]?.regime ?? '5x2'

    const diasUteis = diasUteisNoPeriodo(periodoInicio, periodoFim, regime)

    const feriasDias = ferias
      .filter(f => f.funcionario_id === func.id)
      .reduce((acc, f) => acc + diasSobrepostos(f.data_inicio!, f.data_fim!, mesStartStr, mesEndStr), 0)

    const atestadosDias = atestados
      .filter(a => a.funcionario_id === func.id)
      .reduce((acc, a) => acc + diasSobrepostos(a.data_inicio, a.data_fim, mesStartStr, mesEndStr), 0)

    const faltasDias = faltas
      .filter(f => f.funcionario_id === func.id)
      .reduce((acc, f) => acc + (f.dias ?? 1), 0)

    const advFunc        = advertencias.filter(a => a.funcionario_id === func.id)
    const temAdvertencia = advFunc.length > 0
    const suspensoes     = advFunc.filter(a => a.grau === 'suspensao')
    const temSuspensao   = suspensoes.length > 0
    const diasSuspensao  = suspensoes.reduce((acc, a) => acc + (a.dias_suspensao ?? 0), 0)

    const insalubridadeDias = insalubridades.filter(i => i.funcionario_id === func.id).length

    const diasTrabalhados = Math.max(
      0,
      diasUteis - feriasDias - faltasDias - atestadosDias - diasSuspensao,
    )

    return {
      funcionario_id:    func.id,
      funcionario_nome:  func.nome,
      funcao:            funcoes?.nome ?? null,
      posto_nome:        postos?.nome ?? null,
      secretaria:        postos?.secretaria ?? null,
      regime,
      data_admissao:     func.data_admissao ?? null,
      data_desligamento: func.data_desligamento ?? null,
      periodo_inicio:    periodoInicio.toISOString().split('T')[0],
      periodo_fim:       periodoFim.toISOString().split('T')[0],
      dias_calendario:   diasCalendario,
      dias_uteis:        diasUteis,
      ferias_dias:       feriasDias,
      faltas_dias:       faltasDias,
      atestados_dias:    atestadosDias,
      dias_suspensao:    diasSuspensao,
      dias_trabalhados:  diasTrabalhados,
      tem_advertencia:   temAdvertencia,
      tem_suspensao:     temSuspensao,
      insalubridade_dias: insalubridadeDias,
    }
  })
}
