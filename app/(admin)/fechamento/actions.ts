'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { getUser } from '@/lib/auth/get-user'
import { feriadosDoAno, diasUteisNoPeriodo, toDate } from '@/lib/utils/dias-uteis'
import { obterRegimesPorFuncionario } from '@/lib/turnos/regime-funcionario'
import { TIPOS_ESCALA_POSTO } from '@/lib/turnos/escala'

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
  status: string | null
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
  supervisor_nome: string | null
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
  regimes: string[]
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
        id, nome, registro, data_admissao, data_desligamento, status, posto_id, funcao_id,
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
  const [ferRes, atRes, falRes, advRes, insRes, afaRes, cobRes, todosPostosRes, postoConfigRes, transfRes, supPostoRes, funcoesRes] =
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
        .select('funcionario_id, posto_origem_id, posto_destino_id, data_inicio, data_retorno_real, data_prev_retorno, status')
        .lte('data_inicio', mesEndStr)
        .or(`data_retorno_real.is.null,data_retorno_real.gte.${mesStartStr}`),

      supabase.from('postos').select('id, nome, secretaria').eq('ativo', true),

      supabase.from('config_escalas_postos').select('posto_id, regime'),

      // Histórico completo de posto_id e funcao_id (sem filtro de data — tabela
      // pequena, ~400 linhas no total). Precisamos do histórico INTEIRO, não só
      // até o fim do mês: se a primeira mudança de posto/função da vida do
      // funcionário só aconteceu DEPOIS do mês fechado, é o valor_antes dela (não
      // o posto_id/funcao_id atual) que valia durante o mês.
      supabase
        .from('movimentacoes')
        .select('funcionario_id, campo_alterado, valor_antes, valor_depois, created_at')
        .in('campo_alterado', ['posto_id', 'funcao_id'])
        .order('created_at', { ascending: true }),

      // Supervisor responsável por cada posto (pra aba RH-Postos)
      supabase
        .from('config_supervisores_postos')
        .select('posto_id, perfis!supervisor_id ( nome )')
        .eq('ativo', true),

      supabase.from('funcoes').select('id, nome'),
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
  if (supPostoRes.error)     throw supPostoRes.error
  if (funcoesRes.error)      throw funcoesRes.error

  const ferias         = ferRes.data  ?? []
  const atestados      = atRes.data   ?? []
  const faltas         = falRes.data  ?? []
  const advertencias   = advRes.data  ?? []
  const insalubridades = insRes.data  ?? []
  const afastamentos   = afaRes.data  ?? []
  // Cobertura registrada com origem === destino não é troca real de posto (substituição
  // interna no mesmo local) — não deve gerar rateio nem linha "Cobertura" em outro posto.
  const coberturas     = (cobRes.data ?? []).filter(c => c.posto_origem_id !== c.posto_destino_id)
  const movsPostoId    = (transfRes.data ?? []).filter(m => m.campo_alterado === 'posto_id')
  const movsFuncaoId   = (transfRes.data ?? []).filter(m => m.campo_alterado === 'funcao_id')

  const postosMap = new Map<string, { nome: string; secretaria: string }>()
  for (const p of todosPostosRes.data ?? []) {
    postosMap.set(p.id, { nome: p.nome, secretaria: p.secretaria ?? '' })
  }

  const funcoesMap = new Map<string, string>()
  for (const fn of funcoesRes.data ?? []) {
    funcoesMap.set(fn.id, fn.nome)
  }

  const postoConfigMap = new Map<string, string>()
  for (const pc of postoConfigRes.data ?? []) {
    postoConfigMap.set(pc.posto_id, pc.regime)
  }

  const supervisorPorPosto = new Map<string, string>()
  for (const sp of supPostoRes.data ?? []) {
    const perfil = sp.perfis as unknown as { nome: string } | null
    if (perfil?.nome) supervisorPorPosto.set(sp.posto_id, perfil.nome)
  }

  function agruparHistoricoPorFunc(
    movs: { funcionario_id: string | null; valor_antes: string | null; valor_depois: string | null; created_at: string | null }[],
  ): Map<string, TransferenciaPosto[]> {
    const porFunc = new Map<string, TransferenciaPosto[]>()
    for (const m of movs) {
      if (!m.funcionario_id || !m.created_at) continue
      const arr = porFunc.get(m.funcionario_id) ?? []
      arr.push({ data: toDate(m.created_at.slice(0, 10)), postoAntes: m.valor_antes, postoDepois: m.valor_depois })
      porFunc.set(m.funcionario_id, arr)
    }
    return porFunc
  }

  // Histórico completo (qualquer data, passado ou futuro) por funcionário, em ordem
  // cronológica — usado só pra achar o valor vigente ao fim do mês (abaixo).
  const transferenciasPorFunc = agruparHistoricoPorFunc(movsPostoId)
  const funcaoHistPorFunc     = agruparHistoricoPorFunc(movsFuncaoId)

  // Valor (posto_id/funcao_id) vigente ao FINAL do mês fechado. Sem isso, um
  // funcionário sem mudança DENTRO do mês mas mudado DEPOIS (ex.: fechamento de
  // um mês passado) ficaria com o valor atual (errado). Cobre também o caso em
  // que a 1ª mudança da vida do funcionário só aconteceu depois do mês fechado —
  // aí o valor_antes dela é que valia durante o mês, não o valor atual.
  function resolverValorNoFimDoMes(historicoAsc: TransferenciaPosto[], valorAtual: string | null): string | null {
    const ateOMes = historicoAsc.filter(h => h.data <= mesEnd)
    if (ateOMes.length > 0) return ateOMes[ateOMes.length - 1].postoDepois
    const depoisDoMes = historicoAsc.filter(h => h.data > mesEnd)
    if (depoisDoMes.length > 0) return depoisDoMes[0].postoAntes
    return valorAtual
  }

  const postoAoFimDoMesPorFunc  = new Map<string, string | null>()
  const funcaoAoFimDoMesPorFunc = new Map<string, string | null>()
  for (const func of funcionarios) {
    postoAoFimDoMesPorFunc.set(func.id, resolverValorNoFimDoMes(transferenciasPorFunc.get(func.id) ?? [], func.posto_id ?? null))
    funcaoAoFimDoMesPorFunc.set(func.id, resolverValorNoFimDoMes(funcaoHistPorFunc.get(func.id) ?? [], func.funcao_id ?? null))
  }

  // Regime também precisa do posto de FIM DE MÊS (não o atual) no fallback: sem
  // isso, um funcionário sem turno cadastrado (cai no fallback por posto) usaria o
  // regime do posto ATUAL, que pode ter mudado depois do mês fechado — mesma
  // classe de bug do posto_id, só que escondida dentro do cálculo de dias úteis.
  const postoIdPorFuncionario = new Map<string, string | null>()
  for (const f of funcionarios) {
    postoIdPorFuncionario.set(f.id, postoAoFimDoMesPorFunc.get(f.id) ?? f.posto_id ?? null)
  }
  const regimesPorFuncionario = await obterRegimesPorFuncionario(
    supabase,
    funcionarios.map(f => f.id),
    postoConfigMap,
    postoIdPorFuncionario,
    mesEndStr,
  )

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

    const postoAoFimDoMes = postoAoFimDoMesPorFunc.get(func.id) ?? func.posto_id ?? null

    // Regime vigente no mês fechado: turno histórico (regimesPorFuncionario, já
    // resolvido com o posto de fim de mês) senão o regime configurado no posto
    // de fim de mês (nunca o posto atual, que pode ter mudado depois).
    const regime = regimesPorFuncionario.get(func.id) ?? postoConfigMap.get(postoAoFimDoMes ?? '') ?? '5x2'

    // Função vigente no mês fechado (pode diferir da função atual, se o funcionário
    // mudou de função depois do mês) — ver resolverValorNoFimDoMes acima.
    const funcaoIdNoMes = funcaoAoFimDoMesPorFunc.get(func.id) ?? func.funcao_id ?? null
    const funcaoNoMes   = (funcaoIdNoMes ? funcoesMap.get(funcaoIdNoMes) : null) ?? funcoes?.nome ?? null

    const transferenciasNoMes = (transferenciasPorFunc.get(func.id) ?? [])
      .filter(t => t.data >= mesStart && t.data <= mesEnd)

    const segmentosPosto = buildSegmentosPosto(
      periodoInicio,
      periodoFim,
      postoAoFimDoMes,
      transferenciasNoMes,
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

    const diasUteis = segmentosPosto.reduce(
      (acc, seg) => acc + diasUteisNoPeriodo(seg.inicio, seg.fim, regime, feriados), 0)

    const feriasDias = segmentosPosto.reduce(
      (acc, seg) => acc + feriasNoIntervalo(seg.inicio, seg.fim, regime), 0)

    const atestadosDias = segmentosPosto.reduce(
      (acc, seg) => acc + atestadosNoIntervalo(seg.inicio, seg.fim, regime), 0)

    const afastamentoDias = segmentosPosto.reduce(
      (acc, seg) => acc + afastamentoNoIntervalo(seg.inicio, seg.fim, regime), 0)

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

    // Dias líquidos por segmento de posto (bruto - férias/faltas/atestados/afastamento/cobertura
    // que caem dentro do segmento) — usados na etapa "por posto" pra ratear entre os postos, e
    // pra achar o posto preponderante mesmo quando houve transferência no meio do mês.
    const segmentosNet = segmentosPosto.map(seg => {
      const bruto = diasUteisNoPeriodo(seg.inicio, seg.fim, regime, feriados)
      const fer   = feriasNoIntervalo(seg.inicio, seg.fim, regime)
      const ates  = atestadosNoIntervalo(seg.inicio, seg.fim, regime)
      const afa   = afastamentoNoIntervalo(seg.inicio, seg.fim, regime)
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

    // Posto preponderante = onde ficou mais dias no mês, comparando cada posto PRÓPRIO
    // (por segmento — cobre transferência no meio do mês) contra cada cobertura prestada.
    let postoPrepId   = func.posto_id ?? null
    let postoPrepNome = postos?.nome ?? null
    let secPrep       = postos?.secretaria ?? null
    let maxDias       = 0

    const netPorPostoProprio = new Map<string, number>()
    for (const seg of segmentosNet) {
      const secSeg = postosMap.get(seg.posto_id)?.secretaria ?? ''
      if (secSeg === 'AFASTADOS') continue // não conta como produtivo
      netPorPostoProprio.set(seg.posto_id, (netPorPostoProprio.get(seg.posto_id) ?? 0) + seg.dias_liquido)
    }
    netPorPostoProprio.forEach((dias, pid) => {
      if (dias > maxDias) {
        maxDias       = dias
        postoPrepId   = pid
        const info    = postosMap.get(pid)
        postoPrepNome = info?.nome ?? null
        secPrep       = info?.secretaria ?? null
      }
    })
    for (const c of coberturasPrestadas) {
      if (c.dias_no_posto > maxDias) {
        maxDias       = c.dias_no_posto
        postoPrepId   = c.posto_id
        postoPrepNome = c.posto_nome
        secPrep       = c.secretaria
      }
    }

    // multi_posto sinaliza atividade em >1 posto DENTRO do mês (cobertura prestada).
    // Não confundir com posto_preponderante_id !== posto_id, que pode acontecer com
    // um único posto no mês inteiro (ex.: funcionário transferido de novo só depois
    // do mês fechado) — a aba Por Funcionário trata esse caso separadamente.
    const multiPosto = coberturasPrestadas.length > 0

    return {
      funcionario_id:      func.id,
      funcionario_nome:    func.nome,
      registro:            (func as { registro?: string | null }).registro ?? null,
      funcao:              funcaoNoMes,
      posto_id:            func.posto_id ?? null,
      posto_nome:          postos?.nome ?? null,
      secretaria:          postos?.secretaria ?? null,
      status:              (func as { status?: string | null }).status ?? null,
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
      supervisor_nome:           postoPrepId ? (supervisorPorPosto.get(postoPrepId) ?? null) : null,
    }
  })

  // 4. Por posto
  const porPostoMap = new Map<string, FechamentoPosto>()
  const regimesVistosPorPosto = new Map<string, Set<string>>()

  function getOrCreatePosto(postoId: string): FechamentoPosto {
    if (!porPostoMap.has(postoId)) {
      const info = postosMap.get(postoId)
      porPostoMap.set(postoId, {
        posto_id:   postoId,
        posto_nome: info?.nome ?? '—',
        secretaria: info?.secretaria ?? '',
        regimes:    [],
        funcionarios: [],
      })
    }
    return porPostoMap.get(postoId)!
  }

  function registrarRegimeNoPosto(postoId: string, regime: string) {
    const set = regimesVistosPorPosto.get(postoId) ?? new Set<string>()
    set.add(regime)
    regimesVistosPorPosto.set(postoId, set)
  }

  // Titulares — um lançamento por segmento de posto (rateia dias entre os postos
  // por onde o funcionário passou oficialmente no mês, em caso de transferência).
  for (const f of porFuncionario) {
    const segmentos = segmentosNetPorFuncionario.get(f.funcionario_id) ?? []
    for (const seg of segmentos) {
      if (seg.dias_liquido <= 0) continue
      const posto = getOrCreatePosto(seg.posto_id)
      registrarRegimeNoPosto(seg.posto_id, f.regime)
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
    registrarRegimeNoPosto(cob.posto_destino_id, regime)
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

  for (const posto of Array.from(porPostoMap.values())) {
    const vistos = regimesVistosPorPosto.get(posto.posto_id)
    posto.regimes = vistos && vistos.size > 0
      ? TIPOS_ESCALA_POSTO.filter(r => vistos.has(r))
      : [postoConfigMap.get(posto.posto_id) ?? '5x2']
  }

  const porPosto = Array.from(porPostoMap.values()).sort((a, b) => {
    const sc = a.secretaria.localeCompare(b.secretaria, 'pt-BR')
    if (sc !== 0) return sc
    return a.posto_nome.localeCompare(b.posto_nome, 'pt-BR')
  })

  return { porFuncionario, porPosto }
}
