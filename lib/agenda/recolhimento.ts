import { numeroDia } from '@/lib/agenda/datas'

// Janela mensal do recolhimento de cartão de ponto: destacada na agenda, sem bloquear os dias.
export const JANELA_RECOLHIMENTO_INICIO = 15
export const JANELA_RECOLHIMENTO_FIM = 21

/** true se o dia (YYYY-MM-DD) cai na janela de recolhimento do mês. */
export function ehDiaDaJanela(data: string): boolean {
  const dia = numeroDia(data)
  return dia >= JANELA_RECOLHIMENTO_INICIO && dia <= JANELA_RECOLHIMENTO_FIM
}

/** Janela (datas inclusive) do mês de `data`. */
export function janelaDoMes(data: string): { inicio: string; fim: string } {
  const mes = data.slice(0, 7)
  return {
    inicio: `${mes}-${String(JANELA_RECOLHIMENTO_INICIO).padStart(2, '0')}`,
    fim: `${mes}-${String(JANELA_RECOLHIMENTO_FIM).padStart(2, '0')}`,
  }
}
