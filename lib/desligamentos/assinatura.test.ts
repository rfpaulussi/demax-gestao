import { describe, it, expect } from 'vitest'
import { assinaturaAbreviada } from './assinatura'

describe('assinaturaAbreviada', () => {
  it('usa o apelido cadastrado pelo primeiro nome', () => {
    expect(assinaturaAbreviada('Crislaine Souza Lima')).toBe('Crisl.')
    expect(assinaturaAbreviada('Christian Alves')).toBe('Chris.')
    expect(assinaturaAbreviada('Herbert Costa')).toBe('Heb.')
    expect(assinaturaAbreviada('Pedro')).toBe('Pedro')
    expect(assinaturaAbreviada('Silvanir Santos')).toBe('Sil.')
    expect(assinaturaAbreviada('Rose Maria')).toBe('Ros.')
    expect(assinaturaAbreviada('Braz Oliveira')).toBe('Braz')
  })

  it('ignora caixa, acento e espaços extras', () => {
    expect(assinaturaAbreviada('  ROSE   da Silva ')).toBe('Ros.')
  })

  it('sem apelido cadastrado, usa o primeiro nome', () => {
    expect(assinaturaAbreviada('Fulano de Tal')).toBe('Fulano')
  })

  it('nome vazio não assina', () => {
    expect(assinaturaAbreviada(null)).toBeNull()
    expect(assinaturaAbreviada('   ')).toBeNull()
  })
})
