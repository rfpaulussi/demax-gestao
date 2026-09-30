// Dias de direito de férias calculados na leitura.
// O valor gravado em ferias.dias_direito foi congelado na importação (proporcional
// na data da carga) e nunca mais atualizado; aqui ele é recalculado com base no
// período aquisitivo.

const DIAS_POR_MES = 2.5
const DIAS_PLENO = 30

export const DIAS_ABONO_PADRAO = 10
const ANTECEDENCIA_ABONO_DIAS = 15

/** Abono deve ser pedido até 15 dias antes do fim do período aquisitivo (CLT art. 143 §1º). */
export function abonoForaDoPrazo(periodoFim: string | null, hoje: Date = new Date()): boolean {
  const fim = parse(periodoFim)
  if (!fim) return false
  const limite = new Date(fim)
  limite.setDate(limite.getDate() - ANTECEDENCIA_ABONO_DIAS)
  const ref = new Date(hoje); ref.setHours(0, 0, 0, 0)
  return ref > limite
}

function parse(str: string | null | undefined): Date | null {
  if (!str) return null
  const d = new Date(str.split('T')[0] + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

/** Meses completos entre duas datas (ex.: 01/12 → 01/04 = 4). */
function mesesCompletos(inicio: Date, ref: Date): number {
  let m = (ref.getFullYear() - inicio.getFullYear()) * 12 + (ref.getMonth() - inicio.getMonth())
  if (ref.getDate() < inicio.getDate()) m -= 1
  return Math.max(0, m)
}

export function diasProporcionais(periodoInicio: string | null, hoje: Date = new Date()): number {
  const ini = parse(periodoInicio)
  if (!ini) return DIAS_PLENO
  return Math.min(DIAS_PLENO, Math.floor(mesesCompletos(ini, hoje) * DIAS_POR_MES))
}

/**
 * Dias de direito atuais do período.
 * - concluído/cancelado: mantém o gravado (é o que foi gozado).
 * - período aquisitivo em curso: proporcional (2,5 dias/mês completo), nunca abaixo do gravado.
 * - período aquisitivo encerrado e ainda não gozado: 30 dias.
 */
export function diasDireitoEfetivo(
  item: {
    status: string
    dias_direito: number | null
    periodo_inicio: string | null
    periodo_fim: string | null
  },
  hoje: Date = new Date(),
): number {
  const gravado = item.dias_direito ?? DIAS_PLENO
  if (item.status === 'concluido' || item.status === 'cancelado') return gravado
  if (!item.periodo_inicio) return gravado

  const fim = parse(item.periodo_fim)
  const ref = new Date(hoje); ref.setHours(0, 0, 0, 0)
  if (fim && ref > fim) return Math.max(gravado, DIAS_PLENO)
  return Math.max(gravado, diasProporcionais(item.periodo_inicio, ref))
}
