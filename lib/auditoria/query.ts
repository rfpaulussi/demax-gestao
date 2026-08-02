import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { camposDaSolicitacao } from '@/components/aprovacoes/campos-solicitacao'
import type { TipoSolicitacao } from '@/types'
import {
  badgeParaMovimentacao, CAMPO_LABEL, fmtDataHora, resolveValor, escapeIlike,
  type MapasResolucao,
} from './format'
import type { MovimentacaoAuditoria } from '@/components/auditoria/tabela-auditoria'

export type AuditoriaFiltros = {
  usuario?: string
  tipo?: string
  data_de?: string
  data_ate?: string
  busca?: string
}

type RawMov = {
  id: string
  tipo: string
  campo_alterado: string | null
  valor_antes: string | null
  valor_depois: string | null
  created_at: string
  executado_por: string | null
  funcionarios: { nome: string } | null
  perfis: { nome: string | null; email: string | null } | null
  solicitacoes: {
    tipo: string
    motivo: string | null
    motivo_rejeicao: string | null
    observacao_admin: string | null
    dados_antes: Record<string, unknown> | null
    dados_depois: Record<string, unknown> | null
    perfis: { nome: string | null; email: string | null } | null
  } | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQ = { from: (t: string) => any }

const SELECT = `
  id, tipo, campo_alterado, valor_antes, valor_depois, created_at,
  executado_por,
  funcionarios!funcionario_id ( nome ),
  perfis!executado_por ( nome, email, role ),
  solicitacoes!solicitacao_id ( tipo, motivo, motivo_rejeicao, observacao_admin, dados_antes, dados_depois, perfis!supervisor_id ( nome, email ) )
`

/** Resolve o termo de busca (nome OU RE) para uma lista de funcionario_id — nunca busca por CPF. */
async function resolverIdsBusca(supabase: AnyQ, busca: string): Promise<string[]> {
  const termo = `%${escapeIlike(busca.trim())}%`
  const [{ data: porNome }, { data: porRegistro }] = await Promise.all([
    supabase.from('funcionarios').select('id').ilike('nome', termo),
    supabase.from('funcionarios').select('id').ilike('registro', termo),
  ])
  const ids = new Set<string>()
  for (const f of (porNome ?? []) as { id: string }[]) ids.add(f.id)
  for (const f of (porRegistro ?? []) as { id: string }[]) ids.add(f.id)
  return Array.from(ids)
}

async function carregarMapas(supabase: AnyQ): Promise<MapasResolucao> {
  const [{ data: postosRaw }, { data: funcoesRaw }, { data: turnosRaw }] = await Promise.all([
    supabase.from('postos').select('id, nome'),
    supabase.from('funcoes').select('id, nome'),
    supabase.from('turnos_postos').select('id, nome'),
  ])
  const postos = new Map<string, string>()
  for (const p of (postosRaw ?? []) as { id: string; nome: string }[]) postos.set(p.id, p.nome)
  const funcoes = new Map<string, string>()
  for (const f of (funcoesRaw ?? []) as { id: string; nome: string }[]) funcoes.set(f.id, f.nome)
  const turnos = new Map<string, string>()
  for (const t of (turnosRaw ?? []) as { id: string; nome: string }[]) turnos.set(t.id, t.nome)
  return { postos, funcoes, turnos }
}

function mapearLinha(m: RawMov, maps: MapasResolucao): MovimentacaoAuditoria {
  const badge = badgeParaMovimentacao(m.tipo, m.valor_antes)
  const executor = m.perfis?.nome ?? m.perfis?.email ?? m.executado_por ?? '—'
  const solicitante = m.solicitacoes?.perfis?.nome ?? m.solicitacoes?.perfis?.email ?? null
  const camposDetalhe = m.solicitacoes
    ? camposDaSolicitacao(m.solicitacoes.tipo as TipoSolicitacao, m.solicitacoes.dados_antes, m.solicitacoes.dados_depois)
    : []

  return {
    id: m.id,
    badgeLabel: badge.label,
    badgeCls: badge.cls,
    createdAtFmt: fmtDataHora(m.created_at),
    executor,
    solicitante,
    funcionarioNome: m.funcionarios?.nome ?? '—',
    campoLabel: CAMPO_LABEL[m.campo_alterado ?? ''] ?? m.campo_alterado ?? '—',
    antes: resolveValor(maps, m.campo_alterado, m.valor_antes),
    depois: resolveValor(maps, m.campo_alterado, m.valor_depois),
    motivoSolicitacao: m.solicitacoes?.motivo ?? null,
    motivoRejeicao: m.solicitacoes?.motivo_rejeicao ?? null,
    observacaoAdmin: m.solicitacoes?.observacao_admin ?? null,
    camposDetalhe,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarFiltros(q: any, filtros: AuditoriaFiltros, idsBusca: string[] | null) {
  if (filtros.usuario)  q = q.eq('executado_por', filtros.usuario)
  if (filtros.tipo)     q = q.eq('tipo', filtros.tipo)
  if (filtros.data_de)  q = q.gte('created_at', filtros.data_de)
  if (filtros.data_ate) q = q.lte('created_at', filtros.data_ate + 'T23:59:59')
  if (idsBusca)          q = q.in('funcionario_id', idsBusca.length > 0 ? idsBusca : ['00000000-0000-0000-0000-000000000000'])
  return q
}

export async function buscarMovimentacoesPaginado(
  filtros: AuditoriaFiltros,
  pagina: number,
  porPagina: number,
): Promise<{ movs: MovimentacaoAuditoria[]; total: number }> {
  const supabase = createClient() as unknown as AnyQ

  const idsBusca = filtros.busca?.trim() ? await resolverIdsBusca(supabase, filtros.busca) : null
  if (idsBusca && idsBusca.length === 0) return { movs: [], total: 0 }

  const from = (pagina - 1) * porPagina
  const to = from + porPagina - 1

  const [maps, { data: rows, count }] = await Promise.all([
    carregarMapas(supabase),
    aplicarFiltros(
      supabase.from('movimentacoes').select(SELECT, { count: 'exact' }).order('created_at', { ascending: false }),
      filtros,
      idsBusca,
    ).range(from, to),
  ])

  const movs = ((rows ?? []) as unknown as RawMov[]).map(m => mapearLinha(m, maps))
  return { movs, total: count ?? 0 }
}

export async function buscarMovimentacoesCompleto(filtros: AuditoriaFiltros): Promise<MovimentacaoAuditoria[]> {
  const supabase = createClient() as unknown as AnyQ

  const idsBusca = filtros.busca?.trim() ? await resolverIdsBusca(supabase, filtros.busca) : null
  if (idsBusca && idsBusca.length === 0) return []

  const maps = await carregarMapas(supabase)

  const rows = await fetchAllRows<RawMov>((from, to) =>
    aplicarFiltros(
      supabase.from('movimentacoes').select(SELECT).order('created_at', { ascending: false }),
      filtros,
      idsBusca,
    ).range(from, to),
  )

  return rows.map(m => mapearLinha(m, maps))
}
