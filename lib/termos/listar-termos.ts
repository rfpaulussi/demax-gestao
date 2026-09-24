import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { tipoDoTermo } from './montar-termo'
import type { TermoTipo } from './tipos'

export const TIPOS_COM_TERMO = [
  'transferencia', 'mudanca_funcao', 'promocao', 'mudanca_horario',
  'desligamento', 'afastamento', 'retorno_afastamento', 'alteracao_salario',
] as const

export const DIAS_ATRASO = 3
export const JANELA_DIAS = 90

export type TermoResumo = {
  chave: string
  funcionarioId: string
  funcionarioNome: string
  postoNome: string | null
  tipo: TermoTipo
  tipos: string[]
  dataMov: string // ISO
  supervisorId: string | null
  supervisorNome: string | null
  protocoladoEm: string | null
  protocoladoPorNome: string | null
}

type MovRow = {
  id: string
  tipo: string
  created_at: string | null
  funcionario_id: string
  solicitacao_id: string | null
  funcionarios: { nome: string; postos: { nome: string | null } | null } | null
}

type ProtRow = {
  chave_termo: string
  protocolado_em: string
  perfis: { nome: string | null } | null
}

export function diasDesde(iso: string, agora = Date.now()): number {
  return Math.floor((agora - new Date(iso).getTime()) / 86_400_000)
}

/** Lista termos (agrupados por solicitação) dos últimos `dias` dias, com status de protocolo.
 *  Escopo de supervisor é garantido pela RLS. Tabela ausente => tudo pendente é evitado: retorna protocolos vazios. */
export async function listarTermos(dias = JANELA_DIAS): Promise<TermoResumo[]> {
  const supabase = createClient()
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString()

  let movs: MovRow[] = []
  try {
    movs = await fetchAllRows<MovRow>((from, to) =>
      supabase
        .from('movimentacoes')
        .select('id, tipo, created_at, funcionario_id, solicitacao_id, funcionarios!funcionario_id(nome, postos!posto_id(nome))')
        .in('tipo', TIPOS_COM_TERMO as unknown as string[])
        .gte('created_at', desde)
        .order('created_at', { ascending: false })
        .range(from, to) as unknown as PromiseLike<{ data: MovRow[] | null; error: { message: string } | null }>,
    )
  } catch {
    return []
  }
  if (movs.length === 0) return []

  const grupos = new Map<string, MovRow[]>()
  for (const m of movs) {
    const k = m.solicitacao_id ? `sol:${m.solicitacao_id}` : `mov:${m.id}`
    const g = grupos.get(k)
    if (g) g.push(m)
    else grupos.set(k, [m])
  }

  // Supervisor solicitante
  const solIds = Array.from(new Set(movs.map(m => m.solicitacao_id).filter((x): x is string => !!x)))
  const supPorSol = new Map<string, { id: string | null; nome: string | null }>()
  for (let i = 0; i < solIds.length; i += 150) {
    const { data } = await supabase
      .from('solicitacoes')
      .select('id, supervisor_id, sol:perfis!supervisor_id(nome)')
      .in('id', solIds.slice(i, i + 150))
    for (const s of (data ?? []) as unknown as { id: string; supervisor_id: string | null; sol: { nome: string | null } | null }[]) {
      supPorSol.set(s.id, { id: s.supervisor_id, nome: s.sol?.nome ?? null })
    }
  }

  // Protocolos (tabela pode ainda não existir => lista vazia)
  const protMap = new Map<string, ProtRow>()
  try {
    const { data, error } = await supabase
      .from('termos_protocolo')
      .select('chave_termo, protocolado_em, perfis!protocolado_por(nome)')
    if (!error) for (const p of (data ?? []) as unknown as ProtRow[]) protMap.set(p.chave_termo, p)
  } catch {
    /* tabela ausente */
  }

  const out: TermoResumo[] = []
  grupos.forEach((rows, chave) => {
    const first = rows[0]
    const tipos = Array.from(new Set(rows.map(r => r.tipo)))
    const sup = first.solicitacao_id ? supPorSol.get(first.solicitacao_id) : undefined
    const prot = protMap.get(chave)
    const datas = rows.map(r => r.created_at ?? '').filter(Boolean).sort()
    out.push({
      chave,
      funcionarioId: first.funcionario_id,
      funcionarioNome: first.funcionarios?.nome ?? '—',
      postoNome: first.funcionarios?.postos?.nome ?? null,
      tipo: tipoDoTermo(tipos),
      tipos,
      dataMov: datas[0] ?? new Date().toISOString(),
      supervisorId: sup?.id ?? null,
      supervisorNome: sup?.nome ?? null,
      protocoladoEm: prot?.protocolado_em ?? null,
      protocoladoPorNome: prot ? prot.perfis?.nome ?? null : null,
    })
  })
  return out.sort((a, b) => b.dataMov.localeCompare(a.dataMov))
}

export async function contarTermosPendentes(): Promise<number> {
  try {
    const termos = await listarTermos(JANELA_DIAS)
    return termos.filter(t => !t.protocoladoEm).length
  } catch {
    return 0
  }
}
