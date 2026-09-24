/** Consolidação de termos MANUAIS de horário: 1 termo por funcionário por dia local. Lógica pura (client-safe). */

const FUSO = 'America/Sao_Paulo'
const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' })

/** Data local (AAAA-MM-DD) no fuso de São Paulo. */
export function diaLocal(iso: string): string {
  return fmtDia.format(new Date(iso))
}

export type MovChave = {
  id: string
  funcionario_id: string
  tipo: string
  solicitacao_id: string | null
  created_at: string | null
}

/** Chave estável do termo: sol:<id> | dia:<funcionario>:<AAAA-MM-DD> (horário manual) | mov:<id>. */
export function chaveConsolidada(m: MovChave): string {
  if (m.solicitacao_id) return `sol:${m.solicitacao_id}`
  if (m.tipo === 'mudanca_horario' && m.created_at) return `dia:${m.funcionario_id}:${diaLocal(m.created_at)}`
  return `mov:${m.id}`
}

export function chaveDiaParse(chave: string): { funcionarioId: string; dia: string } | null {
  const m = /^dia:([0-9a-f-]{36}|[^:]+):(\d{4}-\d{2}-\d{2})$/i.exec(chave)
  return m ? { funcionarioId: m[1], dia: m[2] } : null
}

/** Protocolo do grupo. Para chave do dia, aceita também protocolo legado 'mov:<id>' de qualquer mov do grupo. */
export function protocoloDoGrupo<T>(chave: string, movIds: string[], protocolos: Record<string, T>): T | null {
  const direto = protocolos[chave]
  if (direto) return direto
  if (!chave.startsWith('dia:')) return null
  for (const id of movIds) {
    const p = protocolos[`mov:${id}`]
    if (p) return p
  }
  return null
}
