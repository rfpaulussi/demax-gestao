'use client'

import { useState, type InputHTMLAttributes } from 'react'
import { parseHora } from '@/lib/acordos/colar'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string
  onChange: (hhmm: string) => void
}

/**
 * Horário do relógio digitado do jeito que vier: 8, 8:15, 9, 815, 0830, 8h30.
 * Ao sair do campo (ou Enter) vira HH:MM; se não der para entender, o campo fica marcado e o valor não muda.
 */
export function HoraInput({ value, onChange, className = '', placeholder = '8:00', ...rest }: Props) {
  const [rascunho, setRascunho] = useState<string | null>(null)
  const [invalido, setInvalido] = useState(false)

  function confirmar() {
    if (rascunho === null) return
    const t = rascunho.trim()
    if (!t) { onChange(''); setInvalido(false); setRascunho(null); return }
    const h = parseHora(t)
    if (h) { onChange(h); setInvalido(false); setRascunho(null) } else setInvalido(true)
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={rascunho ?? value}
      aria-invalid={invalido || undefined}
      title={invalido ? 'Horário inválido. Use 8, 8:15, 9, 0830…' : rest.title}
      onChange={e => { setRascunho(e.target.value); setInvalido(false) }}
      onBlur={confirmar}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmar() } }}
      className={`${className}${invalido ? ' !border-red-500 !ring-1 !ring-red-500' : ''}`}
    />
  )
}
