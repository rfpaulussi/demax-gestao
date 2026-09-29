import { describe, it, expect } from 'vitest'
import { cidFormatoValido } from './cid-formato'

describe('cidFormatoValido', () => {
  it('aceita categoria e subcategoria', () => {
    for (const c of ['R11', 'Z10.8', 'K29.7', 'M05.8', 'N23', 'R52.0', 'J02', 'S51.9']) expect(cidFormatoValido(c)).toBe(true)
  })
  it('rejeita lixo', () => {
    for (const c of ['', 'r11', 'R1', 'R111', 'Rd1', 'R11.', 'R11.123', 'R11 ', 'Sem CID']) expect(cidFormatoValido(c)).toBe(false)
  })
})
