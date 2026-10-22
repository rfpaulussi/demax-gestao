import { describe, it, expect } from 'vitest'
import { assinaturaConfere } from './assinatura'

const bytes = (...b: number[]) => new Uint8Array(b)

describe('assinaturaConfere', () => {
  it('aceita JPEG, PNG, WEBP e PDF verdadeiros', () => {
    expect(assinaturaConfere('image/jpeg', bytes(0xff, 0xd8, 0xff, 0xe0))).toBe(true)
    expect(assinaturaConfere('image/png', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d))).toBe(true)
    expect(assinaturaConfere('image/webp', bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe(true)
    expect(assinaturaConfere('application/pdf', bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe(true)
  })

  it('recusa executável declarado como imagem', () => {
    expect(assinaturaConfere('image/jpeg', bytes(0x4d, 0x5a, 0x90, 0x00))).toBe(false)
  })

  it('recusa tipo trocado', () => {
    expect(assinaturaConfere('application/pdf', bytes(0xff, 0xd8, 0xff))).toBe(false)
  })

  it('recusa tipo desconhecido e arquivo vazio', () => {
    expect(assinaturaConfere('text/html', bytes(0x3c, 0x68))).toBe(false)
    expect(assinaturaConfere('image/png', bytes())).toBe(false)
  })
})
