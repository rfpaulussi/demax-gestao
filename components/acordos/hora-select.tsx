'use client'

import type { SelectHTMLAttributes } from 'react'

const p2 = (n: number) => String(n).padStart(2, '0')

/** 05:00 → 21:45, de 15 em 15 minutos (o expediente não passa disso). */
const HORAS: string[] = []
for (let m = 5 * 60; m <= 21 * 60 + 45; m += 15) HORAS.push(`${p2(Math.floor(m / 60))}:${p2(m % 60)}`)

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> {
  value: string
  onChange: (hhmm: string) => void
}

/** Horário do relógio em passos de 15 min. Valor fora da lista (ex.: vindo de colagem) continua aparecendo. */
export function HoraSelect({ value, onChange, ...rest }: Props) {
  const fora = value !== '' && !HORAS.includes(value)
  return (
    <select {...rest} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">--:--</option>
      {fora && <option value={value}>{value}</option>}
      {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
    </select>
  )
}
