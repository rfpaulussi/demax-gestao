/**
 * Regra de vigência mensal das coberturas insalubres.
 *
 * Um registro guarda `mes`/`ano` derivados de `data_cobertura` e a apuração do
 * fechamento soma `periodo_dias` filtrando por esse mês. Se um lançamento
 * atravessa a virada, os dias do mês seguinte acabam contados no mês anterior.
 * Por isso cada lançamento precisa terminar dentro do próprio mês — a parte que
 * sobra vira um novo registro começando no dia 1º do mês seguinte.
 */

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** Meio-dia evita que fuso horário empurre a data para o dia anterior. */
function parse(iso: string): Date {
  return new Date(iso + 'T12:00:00')
}

function toIso(d: Date): string {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export function somarDias(iso: string, n: number): string {
  const d = parse(iso)
  d.setDate(d.getDate() + n)
  return toIso(d)
}

export function fmtBr(iso: string): string {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

export function nomeDoMes(iso: string): string {
  return MESES[parse(iso).getMonth()]
}

export interface AvaliacaoPeriodo {
  /** true quando o período termina depois do último dia do mês de início. */
  ultrapassa: boolean
  /** Dias que cabem de `inicio` até o fim do mês, inclusive. */
  diasNoMes: number
  /** Dias que sobram para o mês seguinte. */
  diasExcedentes: number
  /** Último dia do mês de `inicio`, ISO. */
  fimDoMes: string
  /** Data em que o período realmente termina, ISO. */
  fimCalculado: string
  /** Dia 1º do mês seguinte — onde a continuação deve ser lançada. */
  inicioProximoMes: string
}

export function avaliarPeriodo(inicio: string, dias: number): AvaliacaoPeriodo | null {
  if (!inicio || !Number.isFinite(dias) || dias < 1) return null

  const d = parse(inicio)
  const fimMesDate = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)
  const fimDoMes = toIso(fimMesDate)

  const diasNoMes = Math.round((fimMesDate.getTime() - d.getTime()) / 86400000) + 1
  const fimCalculado = somarDias(inicio, dias - 1)

  return {
    ultrapassa: dias > diasNoMes,
    diasNoMes,
    diasExcedentes: Math.max(0, dias - diasNoMes),
    fimDoMes,
    fimCalculado,
    inicioProximoMes: somarDias(fimDoMes, 1),
  }
}

/**
 * Mensagem única usada no modal, na edição inline e nas Server Actions, para
 * que o usuário leia sempre a mesma instrução independente de onde errou.
 */
export function mensagemUltrapassaMes(a: AvaliacaoPeriodo, inicio: string): string {
  const plural = (n: number) => `${n} dia${n !== 1 ? 's' : ''}`
  return (
    `O período termina em ${fmtBr(a.fimCalculado)} e ultrapassa o fim de ${nomeDoMes(inicio)}. ` +
    `Registre ${plural(a.diasNoMes)} (até ${fmtBr(a.fimDoMes)}) e lance ` +
    `${plural(a.diasExcedentes)} num novo registro a partir de ${fmtBr(a.inicioProximoMes)}.`
  )
}
