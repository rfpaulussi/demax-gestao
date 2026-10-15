import { notFound } from 'next/navigation'
import { BackButton } from '@/components/ui/back-button'
import { createClient } from '@/lib/supabase/server'
import { ProntuarioClient } from '@/components/efetivo/prontuario-client'

export interface ProntuarioFuncionario {
  id: string
  nome: string
  cpf: string | null
  funcao: string | null
  posto: string | null
  secretaria: string | null
  status: string | null
  data_admissao: string | null
  data_desligamento: string | null
  tipo_desligamento: string | null
  motivo_desligamento: string | null
}

export interface ProntuarioEvento {
  id: string
  tipo: string
  data: string         // date used for simulation / sorting
  dataDisplay?: string // date shown in UI (may differ from data for admissao events)
  descricao: string | null
  dados_anteriores: Record<string, unknown> | null
  dados_novos: Record<string, unknown> | null
  // 'suspensao': falta lançada automaticamente por uma suspensão — mesmo incidente, não conta como falta
  origem?: 'suspensao'
  // mudança de função desfeita pouco depois (A→B→A): mostrada esmaecida, não altera o histórico mensal
  correcao?: boolean
}

export interface PeriodoFerias {
  inicio: string
  fim: string
  status: string
}

type Rec = Record<string, unknown>

// Férias que de fato foram/estão sendo gozadas — só estas pintam o mês como "Férias"
const FERIAS_STATUS_GOZADAS = ['aprovado', 'em_curso', 'concluido']
// Férias que nunca ocorreram — o evento criado pelo trigger no INSERT não deve aparecer
const FERIAS_STATUS_DESCARTADAS = ['cancelado', 'disponivel']
// Mudança de função revertida dentro desta janela é tratada como correção de lançamento
const JANELA_CORRECAO_DIAS = 15

function isoToDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  return iso.split('T')[0]
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = iso.split('T')[0]
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function diasEntre(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000
}

function dataSP(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUUID(v: unknown): v is string {
  return typeof v === 'string' && UUID_REGEX.test(v)
}

// A importação de planilha gravou "Status: ATIVO → AFASTADO" como tipo 'transferencia'.
// Reclassifica na leitura (o dado no banco não é alterado).
function reclassificarTipo(tipo: string, da: Rec | null, dn: Rec | null): string {
  if (tipo !== 'transferencia') return tipo
  const temPosto = !!(dn?.posto || dn?.posto_id || dn?.posto_nome)
  const novo = String(dn?.status ?? '').toLowerCase()
  const ant  = String(da?.status ?? '').toLowerCase()
  if (temPosto || !novo) return tipo
  if (novo === 'afastado') return 'afastamento'
  if (ant === 'afastado' && novo === 'ativo') return 'retorno_afastamento'
  return tipo
}

function ehFaltaDeSuspensao(tipoFalta: unknown, observacao: unknown): boolean {
  return tipoFalta === 'suspensao' || /gerada automaticamente/i.test(String(observacao ?? ''))
}

export default async function ProntuarioPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { id } = params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyQ = { from: (t: string) => any }

  const [
    { data: funcRaw },
    { data: historico },
    { data: ferias },
    { data: atestados },
    { data: faltas },
    { data: advertencias },
    { data: movMudancas },
    { data: movHorario },
  ] = await Promise.all([
    supabase
      .from('funcionarios')
      .select('id, nome, cpf, status, data_admissao, data_desligamento, tipo_desligamento, motivo_desligamento, funcoes!funcao_id(nome), postos!posto_id(nome, secretaria)')
      .eq('id', id)
      .single(),
    supabase
      .from('historico_funcionarios')
      .select('*')
      .eq('funcionario_id', id)
      .order('data_evento', { ascending: false }),
    supabase
      .from('ferias')
      .select('*')
      .eq('funcionario_id', id)
      .order('data_inicio', { ascending: false }),
    supabase
      .from('atestados')
      .select('*')
      .eq('funcionario_id', id)
      .order('data_inicio', { ascending: false }),
    supabase
      .from('faltas')
      .select('*')
      .eq('funcionario_id', id)
      .order('data_falta', { ascending: false }),
    supabase
      .from('advertencias')
      .select('*')
      .eq('funcionario_id', id)
      .order('data_ocorrencia', { ascending: false }),
    (supabase as unknown as AnyQ)
      .from('movimentacoes')
      .select('solicitacao_id, valor_antes, valor_depois, created_at, solicitacoes!solicitacao_id(dados_antes, dados_depois, motivo)')
      .eq('funcionario_id', id)
      .eq('tipo', 'mudanca_funcao'),
    (supabase as unknown as AnyQ)
      .from('movimentacoes')
      .select('id, valor_antes, valor_depois, created_at')
      .eq('funcionario_id', id)
      .eq('tipo', 'mudanca_horario'),
  ])

  if (!funcRaw) notFound()

  const f = funcRaw as unknown as {
    id: string
    nome: string
    cpf: string | null
    status: string | null
    data_admissao: string | null
    data_desligamento: string | null
    tipo_desligamento: string | null
    motivo_desligamento: string | null
    funcoes: { nome: string } | null
    postos: { nome: string; secretaria: string | null } | null
  }

  const funcionario: ProntuarioFuncionario = {
    id: f.id,
    nome: f.nome,
    cpf: f.cpf,
    funcao: f.funcoes?.nome ?? null,
    posto: f.postos?.nome ?? null,
    secretaria: f.postos?.secretaria ?? null,
    status: f.status,
    data_admissao: f.data_admissao,
    data_desligamento: f.data_desligamento,
    tipo_desligamento: f.tipo_desligamento,
    motivo_desligamento: f.motivo_desligamento,
  }

  // Se afastado sem posto atual, busca último posto conhecido no histórico
  if (!funcionario.posto && historico && historico.length > 0) {
    const sorted = [...historico].sort((a, b) => b.data_evento.localeCompare(a.data_evento))
    for (const ev of sorted) {
      const dn = ev.dados_novos as Record<string, unknown> | null
      const da = ev.dados_anteriores as Record<string, unknown> | null
      const posto = (dn?.posto ?? da?.posto) as string | null | undefined
      const secretaria = (dn?.secretaria ?? da?.secretaria) as string | null | undefined
      if (posto && !String(posto).toUpperCase().startsWith('AFASTADO')) {
        funcionario.posto = posto
        if (secretaria) funcionario.secretaria = secretaria
        break
      }
    }
  }

  // ── Férias: status atual de cada período (verdade) ──────────────────────────
  const feriasStatusPorInicio = new Map<string, string>()
  for (const fe of ferias ?? []) {
    if (fe.data_inicio) feriasStatusPorInicio.set(fe.data_inicio, fe.status ?? '')
  }
  const feriasDescartada = (dataInicio: string | null | undefined): boolean => {
    if (!dataInicio) return false
    const st = feriasStatusPorInicio.get(dataInicio)
    return !!st && FERIAS_STATUS_DESCARTADAS.includes(st)
  }

  const periodosFerias: PeriodoFerias[] = (ferias ?? [])
    .filter(fe => fe.data_inicio && fe.data_fim && FERIAS_STATUS_GOZADAS.includes(fe.status ?? ''))
    .map(fe => ({ inicio: fe.data_inicio!, fim: fe.data_fim!, status: fe.status ?? '' }))

  // ── Mudança de função: enriquecimento opcional via solicitação (motivo) ────
  // The historico trigger stores funcao_id UUIDs in dados_anteriores/dados_novos, matching
  // movimentacoes.valor_antes / valor_depois — this lets us link without a date collision.
  type MovMudanca = {
    solicitacao_id: string | null
    valor_antes: string | null
    valor_depois: string | null
    created_at: string
    solicitacoes: { dados_antes: Record<string, unknown> | null; dados_depois: Record<string, unknown> | null; motivo: string | null } | null
  }
  const funcaoEnrichMap   = new Map<string, { anterior: string | null; nova: string | null; motivo: string | null }>()
  const movsFuncao = ((movMudancas ?? []) as MovMudanca[]).filter(m => m.solicitacao_id)
  for (const m of ((movMudancas ?? []) as MovMudanca[])) {
    if (!m.solicitacao_id) continue
    const sol = m.solicitacoes
    funcaoEnrichMap.set(m.solicitacao_id, {
      anterior: (sol?.dados_antes?.['funcao_nome'] as string | undefined) ?? null,
      nova:     (sol?.dados_depois?.['funcao_destino_nome'] as string | undefined) ?? null,
      motivo:   sol?.motivo ?? null,
    })
  }

  // O mesmo par função antes→depois pode se repetir (A→B, B→A, A→B): escolhe a movimentação
  // cuja data é a mais próxima do evento, senão o motivo de uma troca aparece na outra.
  function acharSolicitacaoFuncao(antes: string | undefined, depois: string | undefined, dataEvento: string): string | undefined {
    const cands = movsFuncao.filter(m => m.valor_antes === (antes ?? null) && m.valor_depois === (depois ?? null))
    if (cands.length === 0) return undefined
    return cands.reduce((melhor, m) =>
      diasEntre(dataSP(m.created_at), dataEvento) < diasEntre(dataSP(melhor.created_at), dataEvento) ? m : melhor
    ).solicitacao_id ?? undefined
  }

  // ── Índices para evitar duplicidade entre historico (trigger) e tabelas-fonte ─
  const historicoSet = new Set(
    (historico ?? []).map(e => `${e.tipo}:${e.data_evento}`)
  )
  // Advertência/suspensão: o trigger usa data_ocorrencia (advertência) e data_aplicacao (suspensão).
  // Compara pela data_ocorrencia gravada em dados_novos para não duplicar a suspensão.
  const histAdvertOcorrencia = new Set<string>()
  const histSuspOcorrencia   = new Set<string>()
  for (const e of historico ?? []) {
    const dn = e.dados_novos as Rec | null
    const oc = (dn?.data_ocorrencia as string | undefined) ?? e.data_evento
    if (e.tipo === 'advertencia') histAdvertOcorrencia.add(oc)
    if (e.tipo === 'suspensao')   histSuspOcorrencia.add(oc)
  }

  const eventos: ProntuarioEvento[] = [
    // Primary: historico entries (triggers + manual + importação)
    // Exclude monthly snapshot markers (em_ferias:true) and férias que nunca ocorreram
    ...(historico ?? [])
      .filter(e => {
        if (e.tipo !== 'ferias') return true
        const dn = e.dados_novos as Rec | null
        if (dn?.em_ferias === true) return false
        return !feriasDescartada(e.data_evento)
      })
      .map((e): ProntuarioEvento => {
        const da = e.dados_anteriores as Rec | null
        const dn = e.dados_novos as Rec | null
        const tipo = reclassificarTipo(e.tipo, da, dn)

        if (tipo === 'mudanca_funcao') {
          const funcAntesId = da?.['funcao_id'] as string | undefined
          const funcNovaId  = dn?.['funcao_id'] as string | undefined
          const solId  = acharSolicitacaoFuncao(funcAntesId, funcNovaId, e.data_evento)
          const enrich = solId ? funcaoEnrichMap.get(solId) : undefined
          if (enrich) {
            return {
              id: e.id,
              tipo,
              data: e.data_evento,
              descricao: enrich.motivo ? `Motivo: ${enrich.motivo}` : (e.descricao ?? null),
              dados_anteriores: enrich.anterior ? { funcao: enrich.anterior, funcao_id: funcAntesId } : da,
              dados_novos: enrich.nova ? { funcao: enrich.nova, funcao_id: funcNovaId } : dn,
            }
          }
        }

        // Falta lançada automaticamente por suspensão: mesmo incidente da suspensão
        if (tipo === 'falta' && ehFaltaDeSuspensao(dn?.tipo, dn?.observacao)) {
          return {
            id: e.id,
            tipo,
            data: e.data_evento,
            descricao: 'Dia de suspensão (lançado como falta)',
            dados_anteriores: da,
            dados_novos: dn,
            origem: 'suspensao',
          }
        }

        // For admissao events, keep data as the original data_evento (used by the simulation)
        // but set dataDisplay to data_admissao when it predates the historico entry,
        // so the UI shows the real admission date without affecting the simulation.
        const admissaoDisplay = tipo === 'admissao' && funcionario.data_admissao
          && funcionario.data_admissao.split('T')[0] < e.data_evento
          ? funcionario.data_admissao.split('T')[0]
          : undefined
        return {
          id: e.id,
          tipo,
          data: e.data_evento,
          ...(admissaoDisplay ? { dataDisplay: admissaoDisplay } : {}),
          descricao: e.descricao ?? null,
          dados_anteriores: da,
          dados_novos: dn,
        }
      }),

    // Supplementary férias (fallback for data before triggers)
    ...(ferias ?? [])
      .filter(fe => fe.data_inicio && !historicoSet.has(`ferias:${fe.data_inicio}`) && !feriasDescartada(fe.data_inicio))
      .map(fe => ({
        id: `ferias-${fe.id}`,
        tipo: 'ferias' as const,
        data: fe.data_inicio!,
        descricao: `Férias: ${fmt(fe.data_inicio)} a ${fmt(fe.data_fim)}${fe.dias_utilizados ? ` (${fe.dias_utilizados}d)` : ''}`,
        dados_anteriores: null,
        dados_novos: { status: fe.status, data_inicio: fe.data_inicio, data_fim: fe.data_fim, dias_utilizados: fe.dias_utilizados } as Record<string, unknown>,
      })),

    // Supplementary atestados
    ...(atestados ?? [])
      .filter(at => !historicoSet.has(`atestado:${at.data_inicio}`))
      .map(at => ({
        id: `atestado-${at.id}`,
        tipo: 'atestado' as const,
        data: at.data_inicio,
        descricao: `Atestado: ${fmt(at.data_inicio)} a ${fmt(at.data_fim)}${at.motivo ? ` — ${at.motivo}` : ''}`,
        dados_anteriores: null,
        dados_novos: { cid: at.cid_codigo, motivo: at.motivo } as Record<string, unknown>,
      })),

    // Supplementary faltas
    ...(faltas ?? [])
      .filter(fa => !historicoSet.has(`falta:${fa.data_falta}`))
      .map((fa): ProntuarioEvento => {
        const deSuspensao = ehFaltaDeSuspensao(fa.tipo, fa.observacao)
        return {
          id: `falta-${fa.id}`,
          tipo: 'falta',
          data: fa.data_falta,
          descricao: deSuspensao
            ? 'Dia de suspensão (lançado como falta)'
            : `Falta — ${fa.tipo}${fa.observacao ? `: ${fa.observacao}` : ''}`,
          dados_anteriores: null,
          dados_novos: { tipo: fa.tipo, dias: fa.dias, observacao: fa.observacao } as Record<string, unknown>,
          ...(deSuspensao ? { origem: 'suspensao' as const } : {}),
        }
      }),

    // Supplementary advertências/suspensões
    ...(advertencias ?? [])
      .filter(ad => {
        const data = isoToDate(ad.data_ocorrencia) ?? isoToDate(ad.created_at)
        if (!data) return true
        if (ad.grau === 'suspensao') {
          // trigger grava a suspensão em data_aplicacao; compara pela ocorrência
          return !histSuspOcorrencia.has(data)
            && !historicoSet.has(`suspensao:${isoToDate(ad.data_aplicacao) ?? data}`)
        }
        return !histAdvertOcorrencia.has(data) && !historicoSet.has(`advertencia:${data}`)
      })
      .map(ad => {
        const tipo = ad.grau === 'suspensao' ? 'suspensao' : 'advertencia'
        const data = isoToDate(ad.data_ocorrencia) ?? isoToDate(ad.created_at) ?? new Date().toISOString().split('T')[0]
        return {
          id: `advertencia-${ad.id}`,
          tipo,
          data,
          descricao: ad.descricao ?? null,
          dados_anteriores: null,
          dados_novos: { grau: ad.grau, tipo: ad.tipo, dias_suspensao: ad.dias_suspensao } as Record<string, unknown>,
        }
      }),

    // Mudanças de horário (movimentacoes) — nomes resolvidos mais abaixo
    ...((movHorario ?? []) as { id: string; valor_antes: string | null; valor_depois: string | null; created_at: string }[])
      .map((m): ProntuarioEvento => ({
        id: `horario-${m.id}`,
        tipo: 'mudanca_horario',
        data: dataSP(m.created_at),
        descricao: 'Horário alterado',
        dados_anteriores: m.valor_antes ? { turno_id: m.valor_antes } : null,
        dados_novos: m.valor_depois ? { turno_id: m.valor_depois } : null,
      })),
  ]

  // Remove duplicatas reais (mesmo tipo, data e conteúdo). Eventos distintos do mesmo
  // tipo no mesmo dia são mantidos.
  const deduped = new Map<string, ProntuarioEvento>()
  for (const e of eventos) {
    const key = `${e.tipo}:${e.data}:${JSON.stringify(e.dados_novos)}:${JSON.stringify(e.dados_anteriores)}`
    if (!deduped.has(key)) deduped.set(key, e)
  }
  const eventosFinal = Array.from(deduped.values())
  eventosFinal.sort((a, b) => b.data.localeCompare(a.data))

  // ── Resolve UUIDs (posto, função, turno) para nomes legíveis ─────────────────
  const postoIds  = new Set<string>()
  const funcaoIds = new Set<string>()
  const turnoIds  = new Set<string>()
  for (const e of eventosFinal) {
    for (const d of [e.dados_novos, e.dados_anteriores]) {
      if (!d) continue
      if (isUUID(d.posto_id))  postoIds.add(d.posto_id)
      if (isUUID(d.funcao_id)) funcaoIds.add(d.funcao_id)
      if (isUUID(d.turno_id))  turnoIds.add(d.turno_id)
    }
  }

  const [postosRes, funcoesRes, turnosRes] = await Promise.all([
    postoIds.size > 0
      ? supabase.from('postos').select('id, nome, secretaria').in('id', Array.from(postoIds))
      : Promise.resolve({ data: [] as { id: string; nome: string; secretaria: string | null }[] }),
    funcaoIds.size > 0
      ? supabase.from('funcoes').select('id, nome').in('id', Array.from(funcaoIds))
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    turnoIds.size > 0
      ? (supabase as unknown as AnyQ).from('turnos_postos').select('id, nome').in('id', Array.from(turnoIds))
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
  ])

  const postoMap  = new Map((postosRes.data ?? []).map(p => [p.id, p]))
  const funcaoMap = new Map((funcoesRes.data ?? []).map(fn => [fn.id, fn.nome]))
  const turnoMap  = new Map(((turnosRes.data ?? []) as { id: string; nome: string }[]).map(t => [t.id, t.nome]))

  function resolver(d: Rec | null): Rec | null {
    if (!d) return d
    const out: Rec = { ...d }
    if (isUUID(d.posto_id)) {
      const p = postoMap.get(d.posto_id)
      out.posto_nome = p?.nome ?? 'Posto não encontrado'
      if (p?.secretaria) out.secretaria_nome = p.secretaria
    }
    if (isUUID(d.funcao_id) && !out.funcao) {
      out.funcao_nome = funcaoMap.get(d.funcao_id) ?? 'Função não encontrada'
    }
    if (isUUID(d.turno_id)) {
      out.horario = turnoMap.get(d.turno_id) ?? 'Horário não encontrado'
    }
    return out
  }

  for (const e of eventosFinal) {
    e.dados_novos = resolver(e.dados_novos)
    e.dados_anteriores = resolver(e.dados_anteriores)
  }

  // ── Marca mudanças de função revertidas em pouco tempo (A→B→A) como correção ──
  const funcaoOrdenadas = eventosFinal
    .filter(e => e.tipo === 'mudanca_funcao' && e.dados_anteriores?.funcao_id && e.dados_novos?.funcao_id)
    .sort((a, b) => a.data.localeCompare(b.data))
  for (let i = 1; i < funcaoOrdenadas.length; i++) {
    const prev = funcaoOrdenadas[i - 1]
    const cur  = funcaoOrdenadas[i]
    if (prev.correcao) continue
    const desfez =
      cur.dados_novos?.funcao_id === prev.dados_anteriores?.funcao_id &&
      cur.dados_anteriores?.funcao_id === prev.dados_novos?.funcao_id
    if (desfez && diasEntre(prev.data, cur.data) <= JANELA_CORRECAO_DIAS) {
      prev.correcao = true
      cur.correcao = true
    }
  }

  return (
    <div className="space-y-6">
      <BackButton href="/efetivo" label="Voltar ao Efetivo" />
      <div>
        <h1 className="text-lg font-bold text-gray-900">Prontuário</h1>
        <p className="text-sm text-gray-400">Histórico completo do funcionário</p>
      </div>
      <ProntuarioClient funcionario={funcionario} eventos={eventosFinal} ferias={periodosFerias} />
    </div>
  )
}
