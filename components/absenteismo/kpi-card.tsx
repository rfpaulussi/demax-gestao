// components/absenteismo/kpi-card.tsx
import type { ReactNode } from 'react'
import { InfoTip } from './info-tip'

interface Props {
  titulo: string
  valor: string
  /** explicação da fórmula, mostrada no tooltip */
  dica: string
  /** classe completa da borda superior, ex.: "border-t-orange-500" */
  cor: string
  children?: ReactNode
}

export function KpiCard({ titulo, valor, dica, cor, children }: Props) {
  return (
    <div className={`rounded-xl border border-gray-100 border-t-4 ${cor} bg-white p-4 shadow-sm`}>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500">
        {titulo}
        <InfoTip texto={dica} />
      </p>
      <p className="mt-1.5 text-2xl font-black tracking-tight text-gray-900">{valor}</p>
      {children}
    </div>
  )
}
