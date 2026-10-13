import { numeroDia } from '@/lib/agenda/datas'

// Janela sugerida para o recolhimento de cartão de ponto (dias 15 a 21). Serve de sugestão e de destaque:
// o supervisor escolhe o intervalo real (pode terminar antes) e o período (manhã, tarde ou dia inteiro).
export const JANELA_RECOLHIMENTO_INICIO = 15
export const JANELA_RECOLHIMENTO_FIM = 21

/** true se o dia (YYYY-MM-DD) cai na janela sugerida do recolhimento. */
export function ehDiaDaJanela(data: string): boolean {
  const dia = numeroDia(data)
  return dia >= JANELA_RECOLHIMENTO_INICIO && dia <= JANELA_RECOLHIMENTO_FIM
}

/** Primeiro e último dia (inclusive) do mês de `data`, para consultas por mês. */
export function intervaloDoMes(data: string): { inicio: string; fim: string } {
  const mes = data.slice(0, 7)
  return { inicio: `${mes}-01`, fim: `${mes}-31` }
}
