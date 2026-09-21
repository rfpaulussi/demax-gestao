import { describe, it, expect } from 'vitest'
import { anonimizarPedido } from './anonimizar'

const pessoas = [
  { id: 'a', nome: 'MARIA APARECIDA DA SILVA' },
  { id: 'b', nome: 'JOÃO PEDRO SANTOS' },
  { id: 'c', nome: 'JOSÉ CARLOS LIMA' },
  { id: 'd', nome: 'JOSÉ ANTONIO ROCHA' },
]

describe('anonimizarPedido', () => {
  it('troca nome completo, abreviado e só o primeiro nome (quando único) por códigos', () => {
    const r = anonimizarPedido('Maria Aparecida da Silva e João Santos folgam. A Maria também.', pessoas)
    expect(r.texto).toBe('FUNC_1 e FUNC_2 folgam. A FUNC_1 também.')
    expect(r.mapa).toEqual({ FUNC_1: 'a', FUNC_2: 'b' })
  })

  it('ignora acento e caixa', () => {
    expect(anonimizarPedido('joao pedro santos liberado', pessoas).texto).toBe('FUNC_1 liberado')
  })

  it('primeiro nome repetido entre funcionários é ambíguo: não troca', () => {
    expect(anonimizarPedido('José folga na sexta', pessoas).texto).toBe('José folga na sexta')
    expect(anonimizarPedido('José Carlos Lima folga', pessoas).texto).toBe('FUNC_1 folga')
  })

  it('remove CPF, e-mail e telefone', () => {
    const r = anonimizarPedido('CPF 123.456.789-09, mail x@y.com, fone (11) 91234-5678', pessoas)
    expect(r.texto).not.toMatch(/123\.456|@|91234/)
    expect(r.texto).toContain('[DADO REMOVIDO]')
  })

  it('não mexe em palavras que só contêm um nome', () => {
    expect(anonimizarPedido('Mariana e Joãozinho', pessoas).texto).toBe('Mariana e Joãozinho')
  })

  it('texto sem nomes volta igual', () => {
    const r = anonimizarPedido('Liberamos o posto às 12h dia 14/09 por chuva forte', pessoas)
    expect(r.texto).toBe('Liberamos o posto às 12h dia 14/09 por chuva forte')
    expect(r.mapa).toEqual({})
  })
})
