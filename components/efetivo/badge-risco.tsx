import { cn } from '@/lib/utils'
import type { NivelRisco } from '@/lib/risk-score'

const NIVEL_STYLE: Record<NivelRisco, { emoji: string; label: string; className: string }> = {
  ok:      { emoji: '🟢', label: 'ok',       className: 'bg-green-50 text-green-700 ring-green-200' },
  atencao: { emoji: '🟡', label: 'atenção',  className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  critico: { emoji: '🔴', label: 'crítico',  className: 'bg-red-50 text-red-700 ring-red-200'       },
}

export function BadgeRisco({
  score,
  nivel,
  breakdown,
}: {
  score: number
  nivel: NivelRisco
  breakdown: string[]
}) {
  const style = NIVEL_STYLE[nivel]
  const title = breakdown.length > 0 ? breakdown.join(' · ') : 'Nenhuma ocorrência nos últimos 90 dias'

  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        style.className,
      )}
    >
      {style.emoji} Risco: {score}pt
    </span>
  )
}
