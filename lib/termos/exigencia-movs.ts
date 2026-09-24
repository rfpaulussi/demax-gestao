import { consolidarTurnos, exigeTermo } from './exige-termo'
import { paraHorario, type TurnoRow } from './montar-termo'

export type MovParaExigencia = {
  id: string
  tipo: string
  valor_antes: string | null
  valor_depois: string | null
  created_at: string | null
  solicitacao_id: string | null
  solicitacoes?: {
    dados_depois: Record<string, unknown> | null
    perfis: { nome: string | null } | null
  } | null
}

export const chaveDaMov = (m: { id: string; solicitacao_id: string | null }) =>
  m.solicitacao_id ? `sol:${m.solicitacao_id}` : `mov:${m.id}`

/** Ids de turnos citados pelas movimentações de horário (para carga em lote). */
export function idsDeTurnos(movs: MovParaExigencia[]): string[] {
  const s = new Set<string>()
  for (const m of movs) {
    if (m.tipo !== 'mudanca_horario') continue
    if (m.valor_antes) s.add(m.valor_antes)
    if (m.valor_depois) s.add(m.valor_depois)
  }
  return Array.from(s)
}

/** Chaves de termo (sol:/mov:) dos grupos que exigem termo — mesma regra da lista e do PDF. */
export function chavesQueExigemTermo(movs: MovParaExigencia[], turnos: Map<string, TurnoRow>): Set<string> {
  const grupos = new Map<string, MovParaExigencia[]>()
  for (const m of movs) {
    const k = chaveDaMov(m)
    const g = grupos.get(k)
    if (g) g.push(m)
    else grupos.set(k, [m])
  }
  const out = new Set<string>()
  grupos.forEach((rows, chave) => {
    rows.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    const tipos = Array.from(new Set(rows.map(r => r.tipo)))
    const ids = consolidarTurnos(rows.filter(r => r.tipo === 'mudanca_horario'))
    const horario = ids
      ? {
          antes: paraHorario(ids.antesId ? turnos.get(ids.antesId) : undefined),
          depois: paraHorario(ids.depoisId ? turnos.get(ids.depoisId) : undefined),
        }
      : null
    const sol = rows.find(r => r.solicitacoes)?.solicitacoes
    const snap = (sol?.dados_depois?.termo_snapshot ?? {}) as {
      supervisor_origem_nome?: string | null
      supervisor_destino_nome?: string | null
    }
    if (
      exigeTermo({
        tipos,
        horario,
        supervisorOrigem: snap.supervisor_origem_nome ?? null,
        supervisorDestino: snap.supervisor_destino_nome ?? sol?.perfis?.nome ?? null,
      })
    )
      out.add(chave)
  })
  return out
}
