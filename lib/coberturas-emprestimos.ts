import { createAdminClient } from '@/lib/supabase/admin'

export type EmprestimoAtivo = {
  id: string
  funcionario_id: string
  funcionario_nome: string
  posto_origem_id: string | null
  posto_origem_nome: string | null
  posto_destino_id: string | null
  posto_destino_nome: string | null
  supervisor_destino_nome: string | null
  data_prev_retorno: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }

function hojeBR(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

/**
 * Coberturas ativas com nomes resolvidos via service role.
 *
 * Usa o client admin de propósito: com o funcionário emprestado, o `posto_id` dele passa
 * a ser o do posto destino, e o RLS de supervisor (filtrado por posto) esconderia o
 * funcionário/posto do supervisor de origem — que precisa saber para onde ele foi.
 *
 * `postoIds`: restringe às coberturas cujo posto de origem OU destino está na lista
 * (supervisor). `null` = todas (admin/coordenador/viewer).
 */
export async function buscarEmprestimosAtivos(postoIds: string[] | null): Promise<EmprestimoAtivo[]> {
  if (postoIds && postoIds.length === 0) return []

  const admin = createAdminClient() as unknown as AnyClient
  const hoje = hojeBR()

  let q = admin
    .from('coberturas_temporarias')
    .select('id, funcionario_id, posto_origem_id, posto_destino_id, supervisor_destino_id, data_prev_retorno')
    .eq('status', 'ativa')
    .lte('data_inicio', hoje)
    .or(`data_prev_retorno.is.null,data_prev_retorno.gte.${hoje}`)
    .order('data_prev_retorno', { ascending: true, nullsFirst: false })
  if (postoIds) {
    const lista = postoIds.join(',')
    q = q.or(`posto_origem_id.in.(${lista}),posto_destino_id.in.(${lista})`)
  }
  const { data } = await q

  type Raw = {
    id: string
    funcionario_id: string
    posto_origem_id: string | null
    posto_destino_id: string | null
    supervisor_destino_id: string | null
    data_prev_retorno: string | null
  }
  const rows = (data ?? []) as Raw[]
  if (rows.length === 0) return []

  const uniq = (xs: (string | null)[]) => Array.from(new Set(xs.filter((x): x is string => Boolean(x))))
  const funcIds  = uniq(rows.map(r => r.funcionario_id))
  const postoIdsAll = uniq(rows.flatMap(r => [r.posto_origem_id, r.posto_destino_id]))
  const supIds   = uniq(rows.map(r => r.supervisor_destino_id))

  const [{ data: funcs }, { data: postos }, { data: sups }] = await Promise.all([
    admin.from('funcionarios').select('id, nome').in('id', funcIds),
    postoIdsAll.length ? admin.from('postos').select('id, nome').in('id', postoIdsAll) : Promise.resolve({ data: [] }),
    supIds.length ? admin.from('perfis').select('id, nome').in('id', supIds) : Promise.resolve({ data: [] }),
  ])
  const nomeFunc  = new Map<string, string>(((funcs ?? []) as { id: string; nome: string }[]).map(f => [f.id, f.nome]))
  const nomePosto = new Map<string, string>(((postos ?? []) as { id: string; nome: string }[]).map(p => [p.id, p.nome]))
  const nomeSup   = new Map<string, string>(((sups ?? []) as { id: string; nome: string | null }[]).map(s => [s.id, s.nome ?? '']))

  return rows.map(r => ({
    id: r.id,
    funcionario_id: r.funcionario_id,
    funcionario_nome: nomeFunc.get(r.funcionario_id) ?? '—',
    posto_origem_id: r.posto_origem_id,
    posto_origem_nome: r.posto_origem_id ? nomePosto.get(r.posto_origem_id) ?? null : null,
    posto_destino_id: r.posto_destino_id,
    posto_destino_nome: r.posto_destino_id ? nomePosto.get(r.posto_destino_id) ?? null : null,
    supervisor_destino_nome: r.supervisor_destino_id ? nomeSup.get(r.supervisor_destino_id) || null : null,
    data_prev_retorno: r.data_prev_retorno,
  }))
}

/** Postos do supervisor logado (via RLS próprio). Vazio se não for supervisor. */
export async function postoIdsDoSupervisor(
  supabase: AnyClient,
  userId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('config_supervisores_postos')
    .select('posto_id')
    .eq('supervisor_id', userId)
    .eq('ativo', true)
  return ((data ?? []) as { posto_id: string }[]).map(r => r.posto_id)
}
