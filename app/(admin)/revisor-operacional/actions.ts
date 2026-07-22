'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { buscarInconsistenciasFerias, type TipoInconsistencia } from '@/app/(admin)/ferias/actions'

export type Severidade = 'alta' | 'media' | 'baixa'

export type Achado = {
  tipo: string
  severidade: Severidade
  funcionario_id: string | null
  funcionario_nome: string | null
  posto_nome: string | null
  secretaria: string | null
  titulo: string
  descricao: string
  link: string | null
}

type FuncionarioRef = { id: string; nome: string; status: string | null; data_desligamento: string | null; posto_id: string | null }
type PostoRef = { id: string; nome: string; secretaria: string | null }
type AfastamentoRef = { id: string; funcionario_id: string; motivo: string | null; data_inicio: string; data_fim_prevista: string | null; data_fim_real: string | null; created_at: string | null }
type AtestadoRef = { id: string; funcionario_id: string; data_inicio: string; data_fim: string; created_at: string | null }
type SolicitacaoRef = { id: string; tipo: string; funcionario_id: string | null; created_at: string | null }
type OcorrenciaRef = { id: string; posto_id: string | null; data_ocorrencia: string | null; status: string | null; tipo: string | null }
type InsalubridadeRef = { id: string; funcionario_id: string; mes: number; ano: number }

const FERIAS_TIPO_MAP: Record<TipoInconsistencia, { tipo: string; severidade: Severidade }> = {
  MULTIPLOS_EM_CURSO: { tipo: 'FERIAS_MULTIPLOS_EM_CURSO', severidade: 'alta' },
  PA_DUPLICADO: { tipo: 'FERIAS_PA_DUPLICADO', severidade: 'alta' },
  PA_INVERTIDO: { tipo: 'FERIAS_PA_INVERTIDO', severidade: 'media' },
  PA_CURTO: { tipo: 'FERIAS_PA_CURTO', severidade: 'media' },
}

const MS_DIA = 86400000

function fmtData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

export async function buscarAchados(): Promise<Achado[]> {
  // Client de service-role: a página só é acessível a admin/coordenador (gate no page.tsx),
  // e RLS de `solicitacoes` hoje só libera SELECT amplo pra 'admin' (não coordenador) —
  // usar o client comum aqui faria coordenador ver dados incompletos.
  const supabase = createAdminClient()
  const hoje = new Date().toISOString().slice(0, 10)

  const [
    { data: funcionariosRaw },
    { data: postosRaw },
    { data: afastamentosRaw },
    { data: atestadosRaw },
    { data: solicitacoesRaw },
    { data: ocorrenciasRaw },
    { data: insalubridadeRaw },
    inconsistenciasFerias,
  ] = await Promise.all([
    supabase.from('funcionarios').select('id, nome, status, data_desligamento, posto_id'),
    supabase.from('postos').select('id, nome, secretaria'),
    supabase.from('afastamentos').select('id, funcionario_id, motivo, data_inicio, data_fim_prevista, data_fim_real, created_at'),
    supabase.from('atestados').select('id, funcionario_id, data_inicio, data_fim, created_at'),
    supabase.from('solicitacoes').select('id, tipo, funcionario_id, created_at').eq('status', 'pendente'),
    supabase.from('ocorrencias').select('id, posto_id, data_ocorrencia, status, tipo'),
    supabase.from('insalubridade_coberturas').select('id, funcionario_id, mes, ano'),
    buscarInconsistenciasFerias(),
  ])

  const funcionarios = (funcionariosRaw ?? []) as FuncionarioRef[]
  const postos = (postosRaw ?? []) as PostoRef[]
  const afastamentos = (afastamentosRaw ?? []) as AfastamentoRef[]
  const atestados = (atestadosRaw ?? []) as AtestadoRef[]
  const solicitacoes = (solicitacoesRaw ?? []) as SolicitacaoRef[]
  const ocorrencias = (ocorrenciasRaw ?? []) as OcorrenciaRef[]
  const insalubridade = (insalubridadeRaw ?? []) as InsalubridadeRef[]

  const funcMap = new Map(funcionarios.map(f => [f.id, f]))
  const postoMap = new Map(postos.map(p => [p.id, p]))

  function ref(funcionarioId: string | null) {
    const f = funcionarioId ? funcMap.get(funcionarioId) : undefined
    const posto = f?.posto_id ? postoMap.get(f.posto_id) : undefined
    return {
      funcionario_id: f?.id ?? null,
      funcionario_nome: f?.nome ?? null,
      posto_nome: posto?.nome ?? null,
      secretaria: posto?.secretaria ?? null,
    }
  }

  function linkEfetivo(nome: string | null | undefined) {
    return nome ? `/efetivo?busca=${encodeURIComponent(nome)}` : '/efetivo'
  }

  const achados: Achado[] = []

  // 1. Detecção retroativa do bug corrigido na Parte 1: atestado lançado depois
  // de um afastamento já aberto pro mesmo funcionário (exclui o efeito colateral
  // legítimo de solicitação de afastamento por INSS).
  const afastamentosPorFunc = new Map<string, AfastamentoRef[]>()
  for (const a of afastamentos) {
    if (!afastamentosPorFunc.has(a.funcionario_id)) afastamentosPorFunc.set(a.funcionario_id, [])
    afastamentosPorFunc.get(a.funcionario_id)!.push(a)
  }
  for (const at of atestados) {
    for (const af of afastamentosPorFunc.get(at.funcionario_id) ?? []) {
      if ((af.motivo ?? '').toLowerCase().includes('inss')) continue
      if (!af.created_at || !at.created_at) continue
      // Exclui o caso onde os dois registros nascem juntos na mesma ação (ex.: fluxo de
      // coberturas com motivo atestado_medico, que insere afastamento + atestado em sequência,
      // com milissegundos de diferença) — só interessa quando o atestado vem bem depois.
      const horasDeDiferenca = (new Date(at.created_at).getTime() - new Date(af.created_at).getTime()) / 3600000
      if (horasDeDiferenca <= 1) continue
      const fimAfastamento = af.data_fim_real ?? af.data_fim_prevista ?? '9999-12-31'
      if (!(at.data_inicio <= fimAfastamento && at.data_fim >= af.data_inicio)) continue
      achados.push({
        tipo: 'ATESTADO_EM_AFASTAMENTO',
        severidade: 'alta',
        ...ref(at.funcionario_id),
        titulo: 'Atestado lançado com funcionário já afastado',
        descricao: `Atestado criado em ${fmtData(at.created_at)} sobrepõe afastamento aberto desde ${fmtData(af.data_inicio)}.`,
        link: linkEfetivo(funcMap.get(at.funcionario_id)?.nome),
      })
    }
  }

  // 2. Status "afastado" sem nenhum afastamento aberto sustentando esse status.
  const afastamentosAbertosPorFunc = new Set(afastamentos.filter(a => !a.data_fim_real).map(a => a.funcionario_id))
  for (const f of funcionarios) {
    if (f.status === 'afastado' && !afastamentosAbertosPorFunc.has(f.id)) {
      achados.push({
        tipo: 'STATUS_AFASTADO_SEM_REGISTRO',
        severidade: 'alta',
        ...ref(f.id),
        titulo: 'Status "afastado" sem registro de afastamento aberto',
        descricao: 'Funcionário está marcado como afastado, mas não há nenhuma linha aberta em afastamentos sustentando esse status.',
        link: linkEfetivo(f.nome),
      })
    }
  }

  // 3. Afastamento aberto, mas o status do funcionário já mudou pra outra coisa.
  for (const a of afastamentos) {
    if (a.data_fim_real) continue
    const f = funcMap.get(a.funcionario_id)
    if (f && f.status !== 'afastado') {
      achados.push({
        tipo: 'AFASTAMENTO_ABERTO_SEM_STATUS',
        severidade: 'alta',
        ...ref(a.funcionario_id),
        titulo: 'Afastamento aberto sem status correspondente',
        descricao: `Há um afastamento aberto desde ${fmtData(a.data_inicio)}, mas o status atual é "${f.status ?? '—'}".`,
        link: linkEfetivo(f.nome),
      })
    }
  }

  // 4. Desligado sem data de desligamento.
  for (const f of funcionarios) {
    if (f.status === 'desligado' && !f.data_desligamento) {
      achados.push({
        tipo: 'DESLIGADO_SEM_DATA',
        severidade: 'media',
        ...ref(f.id),
        titulo: 'Desligado sem data de desligamento',
        descricao: 'Funcionário está marcado como desligado, mas não tem data de desligamento registrada.',
        link: linkEfetivo(f.nome),
      })
    }
  }

  // 5. Status "atestado" sem nenhum atestado vigente — nada reverte isso sozinho.
  const atestadoVigentePorFunc = new Set(atestados.filter(at => at.data_fim >= hoje).map(at => at.funcionario_id))
  for (const f of funcionarios) {
    if (f.status === 'atestado' && !atestadoVigentePorFunc.has(f.id)) {
      achados.push({
        tipo: 'ATESTADO_VENCIDO_STATUS_PRESO',
        severidade: 'media',
        ...ref(f.id),
        titulo: 'Status "atestado" sem atestado vigente',
        descricao: 'O status ainda é "atestado", mas não há atestado com data fim hoje ou no futuro.',
        link: linkEfetivo(f.nome),
      })
    }
  }

  // 6. Solicitação pendente há muito tempo sem decisão do admin.
  for (const s of solicitacoes) {
    if (!s.created_at) continue
    const dias = Math.floor((Date.now() - new Date(s.created_at).getTime()) / MS_DIA)
    if (dias >= 15) {
      achados.push({
        tipo: 'SOLICITACAO_PENDENTE_ANTIGA',
        severidade: dias >= 30 ? 'alta' : 'media',
        ...ref(s.funcionario_id),
        titulo: `Solicitação pendente há ${dias} dias`,
        descricao: `Solicitação do tipo "${s.tipo}" está pendente de aprovação desde ${fmtData(s.created_at)}.`,
        link: '/aprovacoes',
      })
    }
  }

  // 7. Ocorrência aberta há mais de 30 dias sem análise.
  for (const o of ocorrencias) {
    if (o.status !== 'aberta' || !o.data_ocorrencia) continue
    const dias = Math.floor((Date.now() - new Date(o.data_ocorrencia + 'T00:00:00').getTime()) / MS_DIA)
    if (dias >= 30) {
      const posto = o.posto_id ? postoMap.get(o.posto_id) : undefined
      achados.push({
        tipo: 'OCORRENCIA_ABERTA_PROLONGADA',
        severidade: 'media',
        funcionario_id: null,
        funcionario_nome: null,
        posto_nome: posto?.nome ?? (o.tipo === 'alerta' ? 'Alerta' : null),
        secretaria: posto?.secretaria ?? null,
        titulo: `Ocorrência aberta há ${dias} dias`,
        descricao: 'Segue com status "aberta" há mais de 30 dias sem análise.',
        link: '/ocorrencias',
      })
    }
  }

  // 8. Mais de uma cobertura de insalubridade pro mesmo funcionário no mesmo mês.
  const insalubridadePorChave = new Map<string, InsalubridadeRef[]>()
  for (const i of insalubridade) {
    const chave = `${i.funcionario_id}-${i.mes}-${i.ano}`
    if (!insalubridadePorChave.has(chave)) insalubridadePorChave.set(chave, [])
    insalubridadePorChave.get(chave)!.push(i)
  }
  for (const itens of Array.from(insalubridadePorChave.values())) {
    if (itens.length > 1) {
      achados.push({
        tipo: 'DUPLICIDADE_INSALUBRIDADE',
        severidade: 'media',
        ...ref(itens[0].funcionario_id),
        titulo: 'Cobertura de insalubridade duplicada no mês',
        descricao: `${itens.length} registros de cobertura de insalubridade para ${itens[0].mes}/${itens[0].ano}.`,
        link: linkEfetivo(funcMap.get(itens[0].funcionario_id)?.nome),
      })
    }
  }

  // Reaproveita as 4 regras de férias já existentes, sem alterar ferias/actions.ts.
  for (const inc of inconsistenciasFerias) {
    const cfg = FERIAS_TIPO_MAP[inc.tipo]
    achados.push({
      tipo: cfg.tipo,
      severidade: cfg.severidade,
      funcionario_id: inc.funcionario_id,
      funcionario_nome: inc.funcionario_nome,
      posto_nome: inc.posto_nome,
      secretaria: inc.secretaria,
      titulo: 'Inconsistência de férias',
      descricao: inc.descricao,
      link: `/ferias?busca=${encodeURIComponent(inc.funcionario_nome)}`,
    })
  }

  const ORDEM: Record<Severidade, number> = { alta: 0, media: 1, baixa: 2 }
  return achados.sort(
    (a, b) => ORDEM[a.severidade] - ORDEM[b.severidade] || (a.funcionario_nome ?? '').localeCompare(b.funcionario_nome ?? '', 'pt-BR'),
  )
}
