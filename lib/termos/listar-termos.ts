import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { createAdminClient } from '@/lib/supabase/admin'
import { tipoDoTermo, paraHorario, TURNO_COLUNAS, type TurnoRow } from './montar-termo'
import { consolidarTurnos, exigeTermo } from './exige-termo'
import { DATA_CORTE_TERMOS, DIAS_ATRASO, JANELA_DIAS, statusDoTermo, type StatusTermo } from './constantes'
import { chaveConsolidada, protocoloDoGrupo } from './consolidar-dia'
import { supervisoresAtuaisPorPosto } from './supervisor-posto'
import type { TermoTipo } from './tipos'

export { DATA_CORTE_TERMOS, DIAS_ATRASO, JANELA_DIAS }

/** Só alteração de horário/escala e troca de supervisor (via transferência) geram termo para o RH. */
export const TIPOS_COM_TERMO = ['transferencia', 'mudanca_horario'] as const

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
  status: StatusTermo
}

type MovRow = {
  id: string
  tipo: string
  valor_antes: string | null
  valor_depois: string | null
  created_at: string | null
  funcionario_id: string
  solicitacao_id: string | null
  funcionarios: { nome: string; posto_id: string | null; postos: { nome: string | null } | null } | null
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
        .select('id, tipo, valor_antes, valor_depois, created_at, funcionario_id, solicitacao_id, funcionarios!funcionario_id(nome, posto_id, postos!posto_id(nome))')
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
    const k = chaveConsolidada(m)
    const g = grupos.get(k)
    if (g) g.push(m)
    else grupos.set(k, [m])
  }

  // Supervisor solicitante
  const solIds = Array.from(new Set(movs.map(m => m.solicitacao_id).filter((x): x is string => !!x)))
  type SupSol = { id: string | null; nome: string | null; origem: string | null; destino: string | null }
  const supPorSol = new Map<string, SupSol>()
  for (let i = 0; i < solIds.length; i += 150) {
    const { data } = await supabase
      .from('solicitacoes')
      .select('id, supervisor_id, dados_depois, sol:perfis!supervisor_id(nome)')
      .in('id', solIds.slice(i, i + 150))
    for (const s of (data ?? []) as unknown as {
      id: string; supervisor_id: string | null; dados_depois: Record<string, unknown> | null; sol: { nome: string | null } | null
    }[]) {
      const snap = (s.dados_depois?.termo_snapshot ?? {}) as { supervisor_origem_nome?: string | null; supervisor_destino_nome?: string | null }
      supPorSol.set(s.id, {
        id: s.supervisor_id,
        nome: s.sol?.nome ?? null,
        origem: snap.supervisor_origem_nome ?? null,
        destino: snap.supervisor_destino_nome ?? s.sol?.nome ?? null,
      })
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

  // Turnos (conteúdo) dos movimentos de horário — em lote
  const turnoIds = new Set<string>()
  for (const m of movs) {
    if (m.tipo !== 'mudanca_horario') continue
    if (m.valor_antes) turnoIds.add(m.valor_antes)
    if (m.valor_depois) turnoIds.add(m.valor_depois)
  }
  const turnos = new Map<string, TurnoRow>()
  const idsT = Array.from(turnoIds)
  if (idsT.length > 0) {
    const admin = createAdminClient()
    for (let i = 0; i < idsT.length; i += 150) {
      const { data } = await admin.from('turnos_postos').select(TURNO_COLUNAS).in('id', idsT.slice(i, i + 150))
      for (const t of (data ?? []) as TurnoRow[]) turnos.set(t.id, t)
    }
  }

  // Supervisor ATUAL do posto (termo manual), em lote
  const postoIdsManuais = movs.filter(m => !m.solicitacao_id).map(m => m.funcionarios?.posto_id ?? '')
  const supAtual = await supervisoresAtuaisPorPosto(createAdminClient(), postoIdsManuais)

  const out: TermoResumo[] = []
  grupos.forEach((rows, chave) => {
    rows.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    const first = rows[0]
    const tipos = Array.from(new Set(rows.map(r => r.tipo)))
    const sup = first.solicitacao_id ? supPorSol.get(first.solicitacao_id) : undefined
    const protRec: Record<string, ProtRow> = {}
    protMap.forEach((v, k) => { protRec[k] = v })
    const prot = protocoloDoGrupo(chave, rows.map(r => r.id), protRec)
    const datas = rows.map(r => r.created_at ?? '').filter(Boolean).sort()
    const ids = consolidarTurnos(rows.filter(r => r.tipo === 'mudanca_horario'))
    const horario = ids
      ? {
          antes: paraHorario(ids.antesId ? turnos.get(ids.antesId) : undefined),
          depois: paraHorario(ids.depoisId ? turnos.get(ids.depoisId) : undefined),
        }
      : null
    // MESMA regra usada por carregarTermo (PDF) e pelo perfil
    if (!exigeTermo({ tipos, horario, supervisorOrigem: sup?.origem ?? null, supervisorDestino: sup?.destino ?? null })) return
    const dataMov = datas[0] ?? new Date().toISOString()
    out.push({
      chave,
      funcionarioId: first.funcionario_id,
      funcionarioNome: first.funcionarios?.nome ?? '—',
      postoNome: first.funcionarios?.postos?.nome ?? null,
      tipo: tipoDoTermo(tipos),
      tipos,
      dataMov,
      supervisorId: sup?.id ?? null,
      supervisorNome: sup?.nome ?? (first.solicitacao_id ? null : supAtual.get(first.funcionarios?.posto_id ?? '') ?? null),
      protocoladoEm: prot?.protocolado_em ?? null,
      protocoladoPorNome: prot ? prot.perfis?.nome ?? null : null,
      status: statusDoTermo(dataMov, prot?.protocolado_em ?? null),
    })
  })
  return out.sort((a, b) => b.dataMov.localeCompare(a.dataMov))
}

export async function contarTermosPendentes(): Promise<number> {
  try {
    const termos = await listarTermos(JANELA_DIAS)
    return termos.filter(t => t.status === 'pendente' || t.status === 'atrasado').length
  } catch {
    return 0
  }
}
