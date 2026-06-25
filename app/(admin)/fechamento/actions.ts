'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

const DIAS_COBERTURA_ATESTADO = 15

// ─── interfaces ──────────────────────────────────────────────────────────────

export interface FechamentoFuncionario {
  funcionario_id: string
  funcionario_nome: string
  funcao: string | null
  posto_id: string | null
  posto_nome: string | null
  secretaria: string | null
  data_admissao: string | null
  data_desligamento: string | null
  periodo_inicio: string
  periodo_fim: string
  dias_calendario: number
  regime: string
  dias_uteis: number
  ferias_dias: number
  faltas_dias: number
  atestados_dias: number
  dias_suspensao: number
  afastamento_dias: number
  dias_trabalhados: number
  tem_advertencia: boolean
  tem_suspensao: boolean
  insalubridade_dias: number
  // rota no mês
  coberturas_prestadas: SegmentoCobertura[]
  dias_no_posto_base: number
  // posto onde ficou mais tempo no mês (pode diferir do posto base)
  posto_preponderante_id: string | null
  posto_preponderante_nome: string | null
  secretaria_preponderante: string | null
  multi_posto: boolean
}

export interface SegmentoCobertura {
  posto_id: string
  posto_nome: string
  secretaria: string
  regime: string
  data_inicio: string
  data_fim: string
  dias_no_posto: number
}

export interface FechamentoItemPosto {
  funcionario_id: string
  funcionario_nome: string
  funcao: string | null
  tipo: 'titular' | 'cobertura'
  data_inicio_no_posto: string
  data_fim_no_posto: string
  dias_no_posto: number
  tem_advertencia: boolean
  faltas_dias: number
  atestados_dias: number
  insalubridade_dias: number
  is_posto_preponderante: boolean
  multi_posto: boolean
}

export interface FechamentoPosto {
  posto_id: string
  posto_nome: string
  secretaria: string
  regime: string
  funcionarios: FechamentoItemPosto[]
}

export interface ResultadoFechamento {
  porFuncionario: FechamentoFuncionario[]
  porPosto: FechamentoPosto[]
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function diasUteisNoPeriodo(start: Date, end: Date, regime: string): number {
  if (start > end) return 0
  if (regime === '5x1' || regime === '12x36') {
    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1)
  }
  let count = 0
  const d = new Date(start)
  while (d <= end) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

function diasSobrepostos(aStart: string, aEnd: string, mesStart: string, mesEnd: string): number {
  const s = new Date(Math.max(new Date(aStart + 'T12:00:00').getTime(), new Date(mesStart + 'T12:00:00').getTime()))
  const e = new Date(Math.min(new Date(aEnd + 'T12:00:00').getTime(), new Date(mesEnd + 'T12:00:00').getTime()))
  if (s > e) return 0
  return Math.floor((e.getTime() - s.getTime()) / 86400000) + 1
}

function clipToMes(date: string | null, fallback: string, mesStart: string, mesEnd: string): string {
  const d = date ?? fallback
  if (d < mesStart) return mesStart
  if (d > mesEnd) return mesEnd
  return d
}

// ─── main ────────────────────────────────────────────────────────────────────

export async function calcularFechamento(mes: number, ano: number): Promise<ResultadoFechamento> {
  const supabase = createClient()

  const mesStr      = String(mes).padStart(2, '0')
  const daysInMonth = new Date(ano, mes, 0).getDate()
  const mesStartStr = `${ano}-${mesStr}-01`
  const mesEndStr   = `${ano}-${mesStr}-${String(daysInMonth).padStart(2, '0')}`
  const mesStart    = new Date(mesStartStr + 'T12:00:00')
  const mesEnd      = new Date(mesEndStr   + 'T12:00:00')

  // 1. Funcionários (paginado)
  const funcionariosRaw = await fetchAllRows((from, to) =>
    supabase
      .from('funcionarios')
      .select(`
        id, nome, data_admissao, data_desligamento, status, posto_id,
        funcoes!funcionarios_funcao_id_fkey ( nome ),
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

  if (funcionarios.length === 0) return { porFuncionario: [], porPosto: [] }

  // 2. Busca paralela
  const [ferRes, atRes, falRes, advRes, insRes, afaRes, cobRes, todosPostosRes, postoConfigRes] =
    await Promise.all([
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
        .gte('data_ocorrencia', mesStartStr)
        .lte('data_ocorrencia', mesEndStr),

      supabase
        .from('insalubridade_coberturas')
        .select('funcionario_id')
        .eq('mes', mes)
        .eq('ano', ano),

      supabase
        .from('afastamentos')
        .select('funcionario_id, data_inicio, data_fim_real')
        .lte('data_inicio', mesEndStr)
        .or(`data_fim_real.is.null,data_fim_real.gte.${mesStartStr}`),

      supabase
        .from('coberturas_temporarias')
        .select('funcionario_id, posto_destino_id, data_inicio, data_retorno_real, data_prev_retorno, status')
        .lte('data_inicio', mesEndStr)
        .or(`data_retorno_real.is.null,data_retorno_real.gte.${mesStartStr}`),

      supabase.from('postos').select('id, nome, secretaria'),

      supabase.from('config_escalas_postos').select('posto_id, regime'),
    ])

  const ferias         = ferRes.data  ?? []
  const atestados      = atRes.data   ?? []
  const faltas         = falRes.data  ?? []
  const advertencias   = advRes.data  ?? []
  const insalubridades = insRes.data  ?? []
  const afastamentos   = afaRes.data  ?? []
  const coberturas     = cobRes.data  ?? []

  const postosMap = new Map<string, { nome: string; secretaria: string }>()
  for (const p of todosPostosRes.data ?? []) {
    postosMap.set(p.id, { nome: p.nome, secretaria: p.secretaria ?? '' })
  }

  const postoConfigMap = new Map<string, string>()
  for (const pc of postoConfigRes.data ?? []) {
    postoConfigMap.set(pc.posto_id, pc.regime)
  }

  // 3. Por funcionário
  const porFuncionario: FechamentoFuncionario[] = funcionarios.map(func => {
    const admissao     = func.data_admissao     ? new Date(func.data_admissao     + 'T12:00:00') : mesStart
    const desligamento = func.data_desligamento ? new Date(func.data_desligamento + 'T12:00:00') : mesEnd

    const periodoInicio = new Date(Math.max(admissao.getTime(), mesStart.getTime()))
    const periodoFim    = new Date(Math.min(desligamento.getTime(), mesEnd.getTime()))

    const diasCalendario = Math.max(0, Math.floor((periodoFim.getTime() - periodoInicio.getTime()) / 86400000) + 1)

    const postos  = func.postos  as unknown as { nome: string; secretaria: string | null; config_escalas_postos: { regime: string }[] | null } | null
    const funcoes = func.funcoes as unknown as { nome: string } | null
    const regime  = postos?.config_escalas_postos?.[0]?.regime ?? postoConfigMap.get(func.posto_id ?? '') ?? '5x2'

    const diasUteis = diasUteisNoPeriodo(periodoInicio, periodoFim, regime)

    const feriasDias = ferias
      .filter(f => f.funcionario_id === func.id)
      .reduce((acc, f) => acc + diasSobrepostos(f.data_inicio!, f.data_fim!, mesStartStr, mesEndStr), 0)

    const atestadosDias = atestados
      .filter(a => a.funcionario_id === func.id)
      .reduce((acc, a) => {
        const fimCoberto = new Date(new Date(a.data_inicio + 'T12:00:00').getTime() + (DIAS_COBERTURA_ATESTADO - 1) * 86400000).toISOString().split('T')[0]
        const fimEfetivo = fimCoberto < a.data_fim ? fimCoberto : a.data_fim
        return acc + diasSobrepostos(a.data_inicio, fimEfetivo, mesStartStr, mesEndStr)
      }, 0)

    const faltasDias = faltas
      .filter(f => f.funcionario_id === func.id)
      .reduce((acc, f) => acc + (f.dias ?? 1), 0)

    const advFunc        = advertencias.filter(a => a.funcionario_id === func.id)
    const suspensoes     = advFunc.filter(a => a.grau === 'suspensao')
    const diasSuspensao  = suspensoes.reduce((acc, a) => acc + (a.dias_suspensao ?? 0), 0)

    const insalubridadeDias = insalubridades.filter(i => i.funcionario_id === func.id).length

    const afastamentoDias = afastamentos
      .filter(a => a.funcionario_id === func.id)
      .reduce((acc, a) => acc + diasSobrepostos(a.data_inicio, a.data_fim_real ?? mesEndStr, mesStartStr, mesEndStr), 0)

    const diasTrabalhados = Math.max(0, diasUteis - feriasDias - faltasDias - atestadosDias - diasSuspensao - afastamentoDias)

    // Coberturas prestadas (foi cobrir outro posto)
    const cobsFunc = coberturas.filter(c => c.funcionario_id === func.id)
    const coberturasPrestadas: SegmentoCobertura[] = cobsFunc.map(c => {
      const inicio  = clipToMes(c.data_inicio, mesStartStr, mesStartStr, mesEndStr)
      const fimRaw  = c.data_retorno_real ?? c.data_prev_retorno ?? mesEndStr
      const fim     = clipToMes(fimRaw, mesEndStr, mesStartStr, mesEndStr)
      const regimeDest = postoConfigMap.get(c.posto_destino_id) ?? '5x2'
      const dias = diasUteisNoPeriodo(new Date(inicio + 'T12:00'), new Date(fim + 'T12:00'), regimeDest)
      const postoInfo = postosMap.get(c.posto_destino_id)
      return {
        posto_id:   c.posto_destino_id,
        posto_nome: postoInfo?.nome ?? '—',
        secretaria: postoInfo?.secretaria ?? '',
        regime:     regimeDest,
        data_inicio: inicio,
        data_fim:    fim,
        dias_no_posto: dias,
      }
    })

    const diasEmCobertura = coberturasPrestadas.reduce((s, c) => s + c.dias_no_posto, 0)
    const diasNoPostoBase = Math.max(0, diasTrabalhados - diasEmCobertura)

    // Posto preponderante = onde ficou mais dias no mês
    const isAfastado = postos?.secretaria === 'AFASTADOS'
    let postoPrepId   = func.posto_id ?? null
    let postoPrepNome = postos?.nome ?? null
    let secPrep       = postos?.secretaria ?? null
    let maxDias       = isAfastado ? 0 : diasNoPostoBase

    for (const c of coberturasPrestadas) {
      if (c.dias_no_posto > maxDias) {
        maxDias       = c.dias_no_posto
        postoPrepId   = c.posto_id
        postoPrepNome = c.posto_nome
        secPrep       = c.secretaria
      }
    }

    const multiPosto = coberturasPrestadas.length > 0

    return {
      funcionario_id:      func.id,
      funcionario_nome:    func.nome,
      funcao:              funcoes?.nome ?? null,
      posto_id:            func.posto_id ?? null,
      posto_nome:          postos?.nome ?? null,
      secretaria:          postos?.secretaria ?? null,
      regime,
      data_admissao:       func.data_admissao ?? null,
      data_desligamento:   func.data_desligamento ?? null,
      periodo_inicio:      periodoInicio.toISOString().split('T')[0],
      periodo_fim:         periodoFim.toISOString().split('T')[0],
      dias_calendario:     diasCalendario,
      dias_uteis:          diasUteis,
      ferias_dias:         feriasDias,
      faltas_dias:         faltasDias,
      atestados_dias:      atestadosDias,
      dias_suspensao:      diasSuspensao,
      afastamento_dias:    afastamentoDias,
      dias_trabalhados:    diasTrabalhados,
      tem_advertencia:     advFunc.length > 0,
      tem_suspensao:       suspensoes.length > 0,
      insalubridade_dias:  insalubridadeDias,
      coberturas_prestadas:      coberturasPrestadas,
      dias_no_posto_base:        diasNoPostoBase,
      posto_preponderante_id:    postoPrepId,
      posto_preponderante_nome:  postoPrepNome,
      secretaria_preponderante:  secPrep,
      multi_posto:               multiPosto,
    }
  })

  // 4. Por posto
  const porPostoMap = new Map<string, FechamentoPosto>()

  function getOrCreatePosto(postoId: string): FechamentoPosto {
    if (!porPostoMap.has(postoId)) {
      const info = postosMap.get(postoId)
      porPostoMap.set(postoId, {
        posto_id:   postoId,
        posto_nome: info?.nome ?? '—',
        secretaria: info?.secretaria ?? '',
        regime:     postoConfigMap.get(postoId) ?? '5x2',
        funcionarios: [],
      })
    }
    return porPostoMap.get(postoId)!
  }

  // Titulares
  for (const f of porFuncionario) {
    if (!f.posto_id) continue
    const posto = getOrCreatePosto(f.posto_id)
    const isAfastadoPosto = posto.secretaria === 'AFASTADOS'
    posto.funcionarios.push({
      funcionario_id:       f.funcionario_id,
      funcionario_nome:     f.funcionario_nome,
      funcao:               f.funcao,
      tipo:                 'titular',
      data_inicio_no_posto: f.periodo_inicio,
      data_fim_no_posto:    f.periodo_fim,
      // Postos AFASTADOS não contam dias úteis (funcionário não está produzindo)
      dias_no_posto:          isAfastadoPosto ? 0 : f.dias_no_posto_base,
      tem_advertencia:        f.tem_advertencia,
      faltas_dias:            f.faltas_dias,
      atestados_dias:         f.atestados_dias,
      insalubridade_dias:     f.insalubridade_dias,
      is_posto_preponderante: f.posto_preponderante_id === f.posto_id,
      multi_posto:            f.multi_posto,
    })
  }

  // Coberturas recebidas em cada posto
  for (const cob of coberturas) {
    if (!cob.posto_destino_id) continue
    const funcData = porFuncionario.find(f => f.funcionario_id === cob.funcionario_id)
    if (!funcData) continue

    const inicio  = clipToMes(cob.data_inicio, mesStartStr, mesStartStr, mesEndStr)
    const fimRaw  = cob.data_retorno_real ?? cob.data_prev_retorno ?? mesEndStr
    const fim     = clipToMes(fimRaw, mesEndStr, mesStartStr, mesEndStr)
    const regime  = postoConfigMap.get(cob.posto_destino_id) ?? '5x2'
    const dias    = diasUteisNoPeriodo(new Date(inicio + 'T12:00'), new Date(fim + 'T12:00'), regime)

    const posto = getOrCreatePosto(cob.posto_destino_id)
    posto.funcionarios.push({
      funcionario_id:         funcData.funcionario_id,
      funcionario_nome:       funcData.funcionario_nome,
      funcao:                 funcData.funcao,
      tipo:                   'cobertura',
      data_inicio_no_posto:   inicio,
      data_fim_no_posto:      fim,
      dias_no_posto:          dias,
      tem_advertencia:        false,
      faltas_dias:            0,
      atestados_dias:         0,
      insalubridade_dias:     0,
      is_posto_preponderante: funcData.posto_preponderante_id === cob.posto_destino_id,
      multi_posto:            funcData.multi_posto,
    })
  }

  const porPosto = Array.from(porPostoMap.values()).sort((a, b) => {
    const sc = a.secretaria.localeCompare(b.secretaria, 'pt-BR')
    if (sc !== 0) return sc
    return a.posto_nome.localeCompare(b.posto_nome, 'pt-BR')
  })

  return { porFuncionario, porPosto }
}
