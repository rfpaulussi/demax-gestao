'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { getUser } from '@/lib/auth/get-user'
import { feriadosDoAno, diasUteisNoPeriodo, toDate } from '@/lib/utils/dias-uteis'

const DIAS_COBERTURA_ATESTADO = 15

// ─── interfaces ──────────────────────────────────────────────────────────────

export interface FechamentoFuncionario {
  funcionario_id: string
  funcionario_nome: string
  registro: string | null
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
  registro: string | null
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

function clipToMes(date: string | null, fallback: string, mesStart: string, mesEnd: string): string {
  const d = date ?? fallback
  if (d < mesStart) return mesStart
  if (d > mesEnd) return mesEnd
  return d
}

interface TransferenciaPosto {
  data: Date
  postoAntes: string | null
  postoDepois: string | null
}

interface SegmentoPosto {
  posto_id: string
  inicio: Date
  fim: Date
}

// Reconstrói em quais postos o funcionário esteve oficialmente lotado durante o
// período, a partir das transferências (movimentacoes.campo_alterado='posto_id')
// aprovadas dentro do mês. Sem transferência no mês, é um único segmento no posto atual.
function buildSegmentosPosto(
  periodoInicio: Date,
  periodoFim: Date,
  postoAtualFinal: string | null,
  transferencias: TransferenciaPosto[],
): SegmentoPosto[] {
  if (transferencias.length === 0) {
    return postoAtualFinal ? [{ posto_id: postoAtualFinal, inicio: periodoInicio, fim: periodoFim }] : []
  }

  const segmentos: SegmentoPosto[] = []
  let cursor      = periodoInicio
  let postoAtual  = transferencias[0].postoAntes ?? postoAtualFinal

  for (const t of transferencias) {
    const dataEfetiva = new Date(Math.max(t.data.getTime(), periodoInicio.getTime()))
    const fimSegmento  = new Date(Math.min(dataEfetiva.getTime() - 86400000, periodoFim.getTime()))
    if (postoAtual && fimSegmento >= cursor) {
      segmentos.push({ posto_id: postoAtual, inicio: cursor, fim: fimSegmento })
    }
    cursor     = dataEfetiva
    postoAtual = t.postoDepois ?? postoAtual
  }
  if (postoAtual && cursor <= periodoFim) {
    segmentos.push({ posto_id: postoAtual, inicio: cursor, fim: periodoFim })
  }
  return segmentos
}

function diasUteisPorSegmentos(
  segmentos: SegmentoPosto[],
  s: Date,
  e: Date,
  postoConfigMap: Map<string, string>,
  feriados: Set<string>,
): number {
  let total = 0
  for (const seg of segmentos) {
    const os = new Date(Math.max(seg.inicio.getTime(), s.getTime()))
    const oe = new Date(Math.min(seg.fim.getTime(), e.getTime()))
    if (os > oe) continue
    const regime = postoConfigMap.get(seg.posto_id) ?? '5x2'
    total += diasUteisNoPeriodo(os, oe, regime, feriados)
  }
  return total
}

// ─── main ────────────────────────────────────────────────────────────────────

export async function calcularFechamento(mes: number, ano: number): Promise<ResultadoFechamento> {
  const userCtx = await getUser()
  if (!userCtx || !userCtx.perfil.role || !['admin', 'coordenador'].includes(userCtx.perfil.role)) {
    throw new Error('Acesso negado')
  }

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
        id, nome, registro, data_admissao, data_desligamento, status, posto_id,
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
  const [ferRes, atRes, falRes, advRes, insRes, afaRes, cobRes, todosPostosRes, postoConfigRes, transfRes] =
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
        .select('funcionario_id, dias, data_falta')
        .gte('data_falta', mesStartStr)
        .lte('data_falta', mesEndStr),

      supabase
        .from('advertencias')
        .select('funcionario_id, grau, dias_suspensao')
        .in('status', ['gerada', 'entregue'])
        .gte('data_ocorrencia', mesStartStr)
        .lte('data_ocorrencia', mesEndStr),

      supabase
        .from('insalubridade_coberturas')
        .select('funcionario_id, periodo_dias')
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

      supabase.from('postos').select('id, nome, secretaria').eq('ativo', true),

      supabase.from('config_escalas_postos').select('posto_id, regime'),

      // Transferências de posto aprovadas dentro do mês — usadas pra ratear dias
      // úteis entre os postos por onde o funcionário passou oficialmente.
      supabase
        .from('movimentacoes')
        .select('funcionario_id, valor_antes, valor_depois, created_at')
        .eq('campo_alterado', 'posto_id')
        .gte('created_at', mesStartStr)
        .lte('created_at', mesEndStr + 'T23:59:59')
        .order('created_at', { ascending: true }),
    ])

  if (ferRes.error)       throw ferRes.error
  if (atRes.error)        throw atRes.error
  if (falRes.error)       throw falRes.error
  if (advRes.error)       throw advRes.error
  if (insRes.error)       throw insRes.error
  if (afaRes.error)       throw afaRes.error
  if (cobRes.error)       throw cobRes.error
  if (todosPostosRes.error)  throw todosPostosRes.error
  if (postoConfigRes.error)  throw postoConfigRes.error
  if (transfRes.error)       throw transfRes.error

  const ferias         = ferRes.data  ?? []
  const atestados      = atRes.data   ?? []
  const faltas         = falRes.data  ?? []
  const advertencias   = advRes.data  ?? []
  const insalubridades = insRes.data  ?? []
  const afastamentos   = afaRes.data  ?? []
  const coberturas     = cobRes.data  ?? []
  const transferencias = transfRes.data ?? []

  const postosMap = new Map<string, { nome: string; secretaria: string }>()
  for (const p of todosPostosRes.data ?? []) {
    postosMap.set(p.id, { nome: p.nome, secretaria: p.secretaria ?? '' })
  }

  const postoConfigMap = new Map<string, string>()
  for (const pc of postoConfigRes.data ?? []) {
    postoConfigMap.set(pc.posto_id, pc.regime)
  }

  const transferenciasPorFunc = new Map<string, TransferenciaPosto[]>()
  for (const m of transferencias) {
    if (!m.funcionario_id || !m.created_at) continue
    const dataStr = m.created_at.slice(0, 10)
    const arr = transferenciasPorFunc.get(m.funcionario_id) ?? []
    arr.push({ data: toDate(dataStr), postoAntes: m.valor_antes, postoDepois: m.valor_depois })
    transferenciasPorFunc.set(m.funcionario_id, arr)
  }

  const feriados = feriadosDoAno(ano)

  // Segmentos de posto (por funcionário) e dias líquidos por segmento — usados
  // na etapa "por posto" pra ratear os dias entre os postos por onde passou no mês.
  const segmentosNetPorFuncionario = new Map<string, (SegmentoPosto & { dias_liquido: number })[]>()

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

    const segmentosPosto = buildSegmentosPosto(
      periodoInicio,
      periodoFim,
      func.posto_id ?? null,
      transferenciasPorFunc.get(func.id) ?? [],
    )

    const feriasFunc       = ferias.filter(f => f.funcionario_id === func.id)
    const atestadosFunc    = atestados.filter(a => a.funcionario_id === func.id)
    const faltasFunc       = faltas.filter(f => f.funcionario_id === func.id)
    const afastamentosFunc = afastamentos.filter(a => a.funcionario_id === func.id)

    function feriasNoIntervalo(s: Date, e: Date, regimeSeg: string): number {
      return feriasFunc.reduce((acc, f) => {
        const fs = clipToMes(f.data_inicio!, mesStartStr, mesStartStr, mesEndStr)
        const fe = clipToMes(f.data_fim!, mesEndStr, mesStartStr, mesEndStr)
        const os = new Date(Math.max(toDate(fs).getTime(), s.getTime()))
        const oe = new Date(Math.min(toDate(fe).getTime(), e.getTime()))
        if (os > oe) return acc
        return acc + diasUteisNoPeriodo(os, oe, regimeSeg, feriados)
      }, 0)
    }

    function atestadosNoIntervalo(s: Date, e: Date, regimeSeg: string): number {
      return atestadosFunc.reduce((acc, a) => {
        const fimCoberto = new Date(toDate(a.data_inicio).getTime() + (DIAS_COBERTURA_ATESTADO - 1) * 86400000).toISOString().split('T')[0]
        const fimEfetivo = fimCoberto < a.data_fim ? fimCoberto : a.data_fim
        const as_ = clipToMes(a.data_inicio, mesStartStr, mesStartStr, mesEndStr)
        const ae  = clipToMes(fimEfetivo, mesEndStr, mesStartStr, mesEndStr)
        const os = new Date(Math.max(toDate(as_).getTime(), s.getTime()))
        const oe = new Date(Math.min(toDate(ae).getTime(), e.getTime()))
        if (os > oe) return acc
        return acc + diasUteisNoPeriodo(os, oe, regimeSeg, feriados)
      }, 0)
    }

    function afastamentoNoIntervalo(s: Date, e: Date, regimeSeg: string): number {
      return afastamentosFunc.reduce((acc, a) => {
        const as_ = clipToMes(a.data_inicio, mesStartStr, mesStartStr, mesEndStr)
        const ae  = clipToMes(a.data_fim_real ?? mesEndStr, mesEndStr, mesStartStr, mesEndStr)
        const os = new Date(Math.max(toDate(as_).getTime(), s.getTime()))
        const oe = new Date(Math.min(toDate(ae).getTime(), e.getTime()))
        if (os > oe) return acc
        return acc + diasUteisNoPeriodo(os, oe, regimeSeg, feriados)
      }, 0)
    }

    const diasUteis = diasUteisPorSegmentos(segmentosPosto, periodoInicio, periodoFim, postoConfigMap, feriados)

    const feriasDias = segmentosPosto.reduce(
      (acc, seg) => acc + feriasNoIntervalo(seg.inicio, seg.fim, postoConfigMap.get(seg.posto_id) ?? '5x2'), 0)

    const atestadosDias = segmentosPosto.reduce(
      (acc, seg) => acc + atestadosNoIntervalo(seg.inicio, seg.fim, postoConfigMap.get(seg.posto_id) ?? '5x2'), 0)

    const afastamentoDias = segmentosPosto.reduce(
      (acc, seg) => acc + afastamentoNoIntervalo(seg.inicio, seg.fim, postoConfigMap.get(seg.posto_id) ?? '5x2'), 0)

    const faltasDias = faltasFunc.reduce((acc, f) => acc + (f.dias ?? 1), 0)

    const advFunc        = advertencias.filter(a => a.funcionario_id === func.id)
    const suspensoes     = advFunc.filter(a => a.grau === 'suspensao')
    const diasSuspensao  = suspensoes.reduce((acc, a) => acc + (a.dias_suspensao ?? 0), 0)

    const insalubridadeDias = (insalubridades as unknown as { funcionario_id: string; periodo_dias: number }[])
      .filter(i => i.funcionario_id === func.id)
      .reduce((s, i) => s + (i.periodo_dias ?? 1), 0)

    const diasTrabalhados = Math.max(0, diasUteis - feriasDias - faltasDias - atestadosDias - diasSuspensao - afastamentoDias)

    // Coberturas prestadas (foi cobrir outro posto)
    const cobsFunc = coberturas.filter(c => c.funcionario_id === func.id)
    const coberturasPrestadas: SegmentoCobertura[] = cobsFunc.map(c => {
      const inicio  = clipToMes(c.data_inicio, mesStartStr, mesStartStr, mesEndStr)
      const fimRaw  = c.data_retorno_real ?? c.data_prev_retorno ?? mesEndStr
      const fim     = clipToMes(fimRaw, mesEndStr, mesStartStr, mesEndStr)
      const regimeDest = postoConfigMap.get(c.posto_destino_id) ?? '5x2'
      const dias = diasUteisNoPeriodo(new Date(inicio + 'T12:00'), new Date(fim + 'T12:00'), regimeDest, feriados)
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

    // Posto preponderante = onde ficou mais dias no mês (posto atual x coberturas)
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

    // Dias líquidos por segmento de posto (bruto - férias/faltas/atestados/afastamento/cobertura
    // que caem dentro do segmento) — usados na etapa "por posto" pra ratear entre os postos.
    const segmentosNet = segmentosPosto.map(seg => {
      const regimeSeg = postoConfigMap.get(seg.posto_id) ?? '5x2'
      const bruto = diasUteisNoPeriodo(seg.inicio, seg.fim, regimeSeg, feriados)
      const fer   = feriasNoIntervalo(seg.inicio, seg.fim, regimeSeg)
      const ates  = atestadosNoIntervalo(seg.inicio, seg.fim, regimeSeg)
      const afa   = afastamentoNoIntervalo(seg.inicio, seg.fim, regimeSeg)
      const falt  = faltasFunc.reduce((acc, f) => {
        if (!f.data_falta) return acc
        const d = toDate(f.data_falta)
        if (d < seg.inicio || d > seg.fim) return acc
        return acc + (f.dias ?? 1)
      }, 0)
      const cob = coberturasPrestadas.reduce((acc, c) => {
        const os = new Date(Math.max(toDate(c.data_inicio).getTime(), seg.inicio.getTime()))
        const oe = new Date(Math.min(toDate(c.data_fim).getTime(),    seg.fim.getTime()))
        if (os > oe) return acc
        return acc + diasUteisNoPeriodo(os, oe, c.regime, feriados)
      }, 0)
      return { posto_id: seg.posto_id, inicio: seg.inicio, fim: seg.fim, dias_liquido: Math.max(0, bruto - fer - ates - afa - falt - cob) }
    })
    segmentosNetPorFuncionario.set(func.id, segmentosNet)

    return {
      funcionario_id:      func.id,
      funcionario_nome:    func.nome,
      registro:            (func as { registro?: string | null }).registro ?? null,
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

  // Titulares — um lançamento por segmento de posto (rateia dias entre os postos
  // por onde o funcionário passou oficialmente no mês, em caso de transferência).
  for (const f of porFuncionario) {
    const segmentos = segmentosNetPorFuncionario.get(f.funcionario_id) ?? []
    for (const seg of segmentos) {
      if (seg.dias_liquido <= 0) continue
      const posto = getOrCreatePosto(seg.posto_id)
      const isAfastadoPosto = posto.secretaria === 'AFASTADOS'
      posto.funcionarios.push({
        funcionario_id:       f.funcionario_id,
        funcionario_nome:     f.funcionario_nome,
        registro:             f.registro,
        funcao:               f.funcao,
        tipo:                 'titular',
        data_inicio_no_posto: seg.inicio.toISOString().split('T')[0],
        data_fim_no_posto:    seg.fim.toISOString().split('T')[0],
        // Postos AFASTADOS não contam dias úteis (funcionário não está produzindo)
        dias_no_posto:          isAfastadoPosto ? 0 : seg.dias_liquido,
        tem_advertencia:        f.tem_advertencia,
        faltas_dias:            f.faltas_dias,
        atestados_dias:         f.atestados_dias,
        insalubridade_dias:     f.insalubridade_dias,
        is_posto_preponderante: f.posto_preponderante_id === seg.posto_id,
        multi_posto:            f.multi_posto,
      })
    }
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
    const dias    = diasUteisNoPeriodo(new Date(inicio + 'T12:00'), new Date(fim + 'T12:00'), regime, feriados)

    const posto = getOrCreatePosto(cob.posto_destino_id)
    posto.funcionarios.push({
      funcionario_id:         funcData.funcionario_id,
      funcionario_nome:       funcData.funcionario_nome,
      registro:               funcData.registro,
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
