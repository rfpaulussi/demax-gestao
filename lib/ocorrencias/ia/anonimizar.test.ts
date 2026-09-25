import { describe, it, expect } from 'vitest'
import { anonimizarOcorrencia, restaurarNomes } from './anonimizar'

const pessoas = [
  { id: 'f1', nome: 'Maria Souza Lima' },
  { id: 'f2', nome: 'João Pereira Santos' },
  { id: 'perfil:s1', nome: 'Carlos Andrade' },
]

describe('anonimizarOcorrencia', () => {
  it('troca nomes de funcionários e de supervisores por códigos', () => {
    const r = anonimizarOcorrencia('Maria Souza Lima discutiu com João Pereira Santos e avisou Carlos Andrade.', pessoas)
    expect(r.texto).not.toContain('Maria')
    expect(r.texto).not.toContain('João')
    expect(r.texto).not.toContain('Carlos')
    expect(r.texto).toMatch(/FUNC_\d/)
    expect(Object.keys(r.nomes)).toHaveLength(3)
  })

  it('guarda o nome real de cada código', () => {
    const r = anonimizarOcorrencia('Maria Souza Lima chegou atrasada.', pessoas)
    expect(Object.values(r.nomes)).toEqual(['Maria Souza Lima'])
  })

  it('remove CPF, e-mail e telefone', () => {
    const r = anonimizarOcorrencia('CPF 123.456.789-09, e-mail a@b.com, fone (11) 98888-7777.', pessoas)
    expect(r.texto).not.toContain('123.456.789-09')
    expect(r.texto).not.toContain('a@b.com')
    expect(r.texto).not.toContain('98888-7777')
  })

  it('não altera texto sem nomes', () => {
    const r = anonimizarOcorrencia('A colaboradora passou mal na unidade.', pessoas)
    expect(r.texto).toBe('A colaboradora passou mal na unidade.')
    expect(r.nomes).toEqual({})
  })
})

describe('restaurarNomes', () => {
  it('devolve os nomes reais no lugar dos códigos', () => {
    const r = anonimizarOcorrencia('Maria Souza Lima e João Pereira Santos brigaram.', pessoas)
    const volta = restaurarNomes(r.texto, r.nomes)
    expect(volta).toContain('Maria Souza Lima')
    expect(volta).toContain('João Pereira Santos')
    expect(volta).not.toMatch(/FUNC_\d/)
  })

  it('mantém um código desconhecido como está', () => {
    expect(restaurarNomes('Falar com FUNC_9.', {})).toBe('Falar com FUNC_9.')
  })
})
