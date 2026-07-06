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
  data: string
  descricao: string | null
  dados_anteriores: Record<string, unknown> | null
  dados_novos: Record<string, unknown> | null
}

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUUID(v: unknown): v is string {
  return typeof v === 'string' && UUID_REGEX.test(v)
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
      .select('solicitacao_id, valor_antes, valor_depois, solicitacoes!solicitacao_id(dados_antes, dados_depois, motivo)')
      .eq('funcionario_id', id)
      .eq('tipo', 'mudanca_funcao'),
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

  // Build solicitacao_id → enrich map; secondary index by "valor_antes:valor_depois" → solicitacao_id
  // The historico trigger stores funcao_id UUIDs in dados_anteriores/dados_novos, matching
  // movimentacoes.valor_antes / valor_depois — this lets us link without a date collision.
  type MovMudanca = {
    solicitacao_id: string | null
    valor_antes: string | null
    valor_depois: string | null
    solicitacoes: { dados_antes: Record<string, unknown> | null; dados_depois: Record<string, unknown> | null; motivo: string | null } | null
  }
  const funcaoEnrichMap   = new Map<string, { anterior: string | null; nova: string | null; motivo: string | null }>()
  const funcaoIdxBySolId  = new Map<string, string>() // "valor_antes:valor_depois" → solicitacao_id
  for (const m of ((movMudancas ?? []) as MovMudanca[])) {
    if (!m.solicitacao_id) continue
    const sol = m.solicitacoes
    funcaoEnrichMap.set(m.solicitacao_id, {
      anterior: (sol?.dados_antes?.['funcao_nome'] as string | undefined) ?? null,
      nova:     (sol?.dados_depois?.['funcao_destino_nome'] as string | undefined) ?? null,
      motivo:   sol?.motivo ?? null,
    })
    funcaoIdxBySolId.set(`${m.valor_antes ?? ''}:${m.valor_depois ?? ''}`, m.solicitacao_id)
  }

  // Track historico entries to avoid duplicates from individual tables
  const historicoSet = new Set(
    (historico ?? []).map(e => `${e.tipo}:${e.data_evento}`)
  )

  const eventos: ProntuarioEvento[] = [
    // Primary: historico entries (triggers + manual)
    ...(historico ?? []).map(e => {
      if (e.tipo === 'mudanca_funcao') {
        const funcAntesId = (e.dados_anteriores as Record<string, unknown> | null)?.['funcao_id'] as string | undefined
        const funcNovaId  = (e.dados_novos      as Record<string, unknown> | null)?.['funcao_id'] as string | undefined
        const solId  = funcaoIdxBySolId.get(`${funcAntesId ?? ''}:${funcNovaId ?? ''}`)
        const enrich = solId ? funcaoEnrichMap.get(solId) : undefined
        if (enrich) {
          return {
            id: e.id,
            tipo: e.tipo,
            data: e.data_evento,
            descricao: enrich.motivo ? `Motivo: ${enrich.motivo}` : (e.descricao ?? null),
            dados_anteriores: enrich.anterior ? { funcao: enrich.anterior } : null,
            dados_novos: enrich.nova ? { funcao: enrich.nova } : (e.dados_novos as Record<string, unknown> | null),
          }
        }
      }
      return {
        id: e.id,
        tipo: e.tipo,
        data: e.data_evento,
        descricao: e.descricao ?? null,
        dados_anteriores: e.dados_anteriores as Record<string, unknown> | null,
        dados_novos: e.dados_novos as Record<string, unknown> | null,
      }
    }),

    // Supplementary férias (fallback for data before triggers)
    ...(ferias ?? [])
      .filter(fe => fe.data_inicio && !historicoSet.has(`ferias:${fe.data_inicio}`))
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
      .map(fa => ({
        id: `falta-${fa.id}`,
        tipo: 'falta' as const,
        data: fa.data_falta,
        descricao: `Falta — ${fa.tipo}${fa.observacao ? `: ${fa.observacao}` : ''}`,
        dados_anteriores: null,
        dados_novos: { tipo: fa.tipo, dias: fa.dias, observacao: fa.observacao } as Record<string, unknown>,
      })),

    // Supplementary advertências/suspensões
    ...(advertencias ?? [])
      .filter(ad => {
        const data = isoToDate(ad.data_ocorrencia) ?? isoToDate(ad.created_at)
        const tipo = ad.grau === 'suspensao' ? 'suspensao' : 'advertencia'
        return data ? !historicoSet.has(`${tipo}:${data}`) : true
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
  ]

  const deduped = new Map<string, ProntuarioEvento>()
  for (const e of eventos) {
    const key = `${e.tipo}:${e.data}`
    if (!deduped.has(key)) deduped.set(key, e)
  }
  const eventosFinal = Array.from(deduped.values())
  eventosFinal.sort((a, b) => b.data.localeCompare(a.data))

  // S2: Resolve posto_id UUIDs to human-readable names
  const postoIdSet = new Set<string>()
  for (const e of eventosFinal) {
    const dn = e.dados_novos
    const da = e.dados_anteriores
    if (dn && isUUID(dn.posto_id)) postoIdSet.add(dn.posto_id)
    if (da && isUUID(da.posto_id)) postoIdSet.add(da.posto_id)
  }
  if (postoIdSet.size > 0) {
    const { data: postosRows } = await supabase
      .from('postos')
      .select('id, nome')
      .in('id', Array.from(postoIdSet))
    const postoNomeMap: Record<string, string> = Object.fromEntries(
      (postosRows ?? []).map(p => [p.id, p.nome])
    )
    for (const e of eventosFinal) {
      const dn = e.dados_novos
      const da = e.dados_anteriores
      if (dn && isUUID(dn.posto_id)) {
        e.dados_novos = { ...dn, posto_nome: postoNomeMap[dn.posto_id] ?? 'Posto não encontrado' }
      }
      if (da && isUUID(da.posto_id)) {
        e.dados_anteriores = { ...da, posto_nome: postoNomeMap[da.posto_id] ?? 'Posto não encontrado' }
      }
    }
  }

  return (
    <div className="space-y-6">
      <BackButton href="/efetivo" label="Voltar ao Efetivo" />
      <div>
        <h1 className="text-lg font-bold text-gray-900">Prontuário</h1>
        <p className="text-sm text-gray-400">Histórico completo do funcionário</p>
      </div>
      <ProntuarioClient funcionario={funcionario} eventos={eventosFinal} />
    </div>
  )
}
