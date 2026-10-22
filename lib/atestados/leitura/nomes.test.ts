import { describe, it, expect } from 'vitest'
import { normalizarNome, partesDoNome, distanciaEdicao, similaridadeNomes } from './nomes'

describe('normalizarNome', () => {
  it('tira acento, caixa e pontuação', () => {
    expect(normalizarNome("  Conceição  d'Ávila-Silva ")).toBe('CONCEICAO D AVILA SILVA')
  })
})

describe('partesDoNome', () => {
  it('ignora as ligações DE, DA, DO, DAS, DOS e E', () => {
    expect(partesDoNome('Maria da Silva e Souza dos Santos')).toEqual(['MARIA', 'SILVA', 'SOUZA', 'SANTOS'])
  })
})

describe('distanciaEdicao', () => {
  it('conta trocas, inserções e remoções', () => {
    expect(distanciaEdicao('ROSALINA', 'ROSALIMA')).toBe(1)
    expect(distanciaEdicao('ANA', 'ANA')).toBe(0)
    expect(distanciaEdicao('', 'ABC')).toBe(3)
  })
})

describe('similaridadeNomes', () => {
  it('dá 1 para nomes iguais, ignorando acento e caixa', () => {
    expect(similaridadeNomes('Ana Paula Souza', 'ANA PAULA SOUZA')).toBe(1)
    expect(similaridadeNomes('Conceição Lima', 'CONCEICAO LIMA')).toBe(1)
  })
  it('tolera uma letra trocada numa parte do nome', () => {
    expect(similaridadeNomes('MARCELA ROSALINA SOARES', 'MARCELA ROSALIMA SOARES')).toBeGreaterThan(0.95)
  })
  it('nome do meio omitido fica em 0,8', () => {
    expect(similaridadeNomes('FERNANDA COSTA', 'FERNANDA OLIVEIRA DA COSTA')).toBeCloseTo(0.8, 5)
  })
  it('dá 0 para nomes sem relação e para vazio', () => {
    expect(similaridadeNomes('JOAO SILVA', 'MARIA SOUSA')).toBe(0)
    expect(similaridadeNomes('', 'ANA')).toBe(0)
  })
})
