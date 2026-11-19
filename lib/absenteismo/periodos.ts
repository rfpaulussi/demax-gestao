// lib/absenteismo/periodos.ts
import { addDias, diffDias, mesAnterior, minData, periodoDoMes } from './datas'
import { periodoEfetivo } from './series'

export interface Intervalo {
  inicio: string
  fim: string
}

/**
 * Período equivalente no mês `alvo`: começa no dia 1 e, se o período atual é parcial por `hoje`
 * (termina antes do fim do mês), termina no mesmo dia relativo. Devolve null quando o alvo não tem
 * base completa (começa antes de `dadosDesde` ou termina depois de `hoje`).
 */
function equivalente(
  alvo: { ano: number; mes: number },
  ano: number,
  mes: number,
  atual: Intervalo,
  dadosDesde: string,
  hoje: string,
): Intervalo | null {
  const cheioAlvo = periodoDoMes(alvo.ano, alvo.mes)
  const cheioAtual = periodoDoMes(ano, mes)
  const truncado = atual.fim < cheioAtual.fim
  const fimAlvo = truncado
    ? minData(cheioAlvo.fim, addDias(cheioAlvo.inicio, diffDias(atual.inicio, atual.fim)))
    : cheioAlvo.fim
  const p = periodoEfetivo(cheioAlvo.inicio, fimAlvo, dadosDesde, hoje)
  if (!p || p.inicio !== cheioAlvo.inicio) return null
  return { inicio: p.inicio, fim: p.fim }
}

export function periodoAnterior(atual: Intervalo, ano: number, mes: number, dadosDesde: string, hoje: string): Intervalo | null {
  return equivalente(mesAnterior(ano, mes), ano, mes, atual, dadosDesde, hoje)
}

export function periodoAnoAnterior(atual: Intervalo, ano: number, mes: number, dadosDesde: string, hoje: string): Intervalo | null {
  return equivalente({ ano: ano - 1, mes }, ano, mes, atual, dadosDesde, hoje)
}
