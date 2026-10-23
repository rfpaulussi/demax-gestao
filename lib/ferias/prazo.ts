// Prazo de gozo de um período de férias. Só períodos ainda não gozados têm prazo a cumprir.

export const STATUS_PENDENTES = ['disponivel', 'agendado', 'aprovado']

// Situações do funcionário que não geram férias a conceder
export const SITUACOES_SEM_FERIAS = ['desligado', 'inativo', 'rescisao_indireta']

export function parseData(str: string | null): Date | null {
  if (!str) return null
  const d = new Date(str + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

export function diasAteLimite(limiteGozo: string | null): number | null {
  const limite = parseData(limiteGozo)
  if (!limite) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.ceil((limite.getTime() - hoje.getTime()) / 86400000)
}

export function prazoLabel(status: string, limiteGozo: string | null): string {
  if (status === 'concluido') return 'Gozado'
  if (status === 'em_curso') return 'Em gozo'
  if (status === 'cancelado') return 'Cancelado'
  const dias = diasAteLimite(limiteGozo)
  if (dias === null) return '—'
  if (dias < 0) return `Vencido há ${Math.abs(dias)}d`
  if (dias <= 60) return `Vence em ${dias}d`
  return 'No prazo'
}
