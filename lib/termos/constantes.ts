/** Constantes client-safe do termo de movimentação (sem imports de servidor). */

/** Termos criados antes desta data são 'legado': fora da contagem/badge e da cobrança de protocolo. */
export const DATA_CORTE_TERMOS = '2026-09-22'
export const DIAS_ATRASO = 3
export const JANELA_DIAS = 90

export type StatusTermo = 'legado' | 'protocolado' | 'atrasado' | 'pendente'

/** Status do termo. Legado = criado antes do corte (mesmo que protocolado depois). */
export function statusDoTermo(
  dataMov: string,
  protocoladoEm: string | null,
  agora = Date.now(),
): StatusTermo {
  if (dataMov.slice(0, 10) < DATA_CORTE_TERMOS) return 'legado'
  if (protocoladoEm) return 'protocolado'
  const dias = Math.floor((agora - new Date(dataMov).getTime()) / 86_400_000)
  return dias > DIAS_ATRASO ? 'atrasado' : 'pendente'
}
