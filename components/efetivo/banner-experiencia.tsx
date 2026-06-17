'use client'

import { cn } from '@/lib/utils'
import type { StatusExperiencia } from '@/lib/experiencia'

interface Props {
  exp: StatusExperiencia
  periodo: '30+30' | '45+45'
}

function fmt(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export function BannerExperiencia({ exp, periodo }: Props) {
  return (
    <div className={cn(
      'rounded-xl border px-5 py-4 shadow-sm',
      exp.alertaCritico
        ? 'border-red-200 bg-red-50'
        : 'border-purple-200 bg-purple-50',
    )}>
      <p className={cn('text-sm font-semibold', exp.alertaCritico ? 'text-red-800' : 'text-purple-800')}>
        Em Período de Experiência — Fase {exp.fase} ({periodo})
      </p>
      <p className={cn('mt-0.5 text-xs', exp.alertaCritico ? 'text-red-600' : 'text-purple-600')}>
        {exp.dataFimFase
          ? `Fase ${exp.fase} encerra em ${fmt(exp.dataFimFase)} · ${exp.diasRestantes} dias restantes`
          : `Fase ${exp.fase}`}
      </p>
    </div>
  )
}
