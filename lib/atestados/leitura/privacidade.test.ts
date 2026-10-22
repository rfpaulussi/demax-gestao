import { describe, it, expect } from 'vitest'
import { removerCpf } from './privacidade'

describe('removerCpf', () => {
  it('remove CPF com máscara', () => {
    expect(removerCpf('529.982.247-25')).toBe('[CPF omitido]')
  })

  it('remove CPF sem máscara', () => {
    expect(removerCpf('52998224725')).toBe('[CPF omitido]')
  })

  it('remove CPF separado por espaços', () => {
    expect(removerCpf('529 982 247 25')).toBe('[CPF omitido]')
  })

  it('remove CPF no meio de uma frase', () => {
    expect(removerCpf('CPF 529.982.247-25 do paciente')).toBe('CPF [CPF omitido] do paciente')
  })

  it('remove dois CPFs', () => {
    expect(removerCpf('529.982.247-25 e 52998224725')).toBe('[CPF omitido] e [CPF omitido]')
  })

  it('mantém texto sem CPF idêntico', () => {
    const texto = 'Carimbo ilegível, data 10/10/2026, CID J11'
    expect(removerCpf(texto)).toBe(texto)
  })

  it('remove número de 11 dígitos mesmo sem formato de CPF', () => {
    expect(removerCpf('protocolo 12345678901')).toBe('protocolo [CPF omitido]')
  })

  it('devolve null para null', () => {
    expect(removerCpf(null)).toBeNull()
  })
})
