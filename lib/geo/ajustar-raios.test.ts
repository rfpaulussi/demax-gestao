import { describe, it, expect } from 'vitest'
import { raioAlvoValido, selecionarParaAjuste, type LinhaRaio } from './ajustar-raios'

const base: LinhaRaio = { id: '1', nome: 'A', latitude: -23.5, longitude: -46.2, geo_confirmado: true, raio_m: 500 }

describe('selecionarParaAjuste', () => {
  it('posto confirmado com raio 500 entra', () => {
    expect(selecionarParaAjuste([base], 150).map(p => p.id)).toEqual(['1'])
  })

  it('posto a conferir não entra (ponto ainda duvidoso)', () => {
    expect(selecionarParaAjuste([{ ...base, geo_confirmado: false }], 150)).toHaveLength(0)
  })

  it('raio escolhido por uma pessoa (menor que 500) nunca é alterado', () => {
    const r = selecionarParaAjuste([
      { ...base, id: 'a', raio_m: 240 },
      { ...base, id: 'b', raio_m: 140 },
      { ...base, id: 'c', raio_m: 499 },
    ], 150)
    expect(r).toHaveLength(0)
  })

  it('raio maior que 500 também entra; raio já igual ou menor que o alvo não', () => {
    expect(selecionarParaAjuste([{ ...base, raio_m: 800 }], 150).map(p => p.id)).toEqual(['1'])
    expect(selecionarParaAjuste([{ ...base, raio_m: 500 }], 500 as number)).toHaveLength(0)
  })

  it('sem ponto ou sem raio não entra', () => {
    expect(selecionarParaAjuste([
      { ...base, id: 's', latitude: null, longitude: null },
      { ...base, id: 'r', raio_m: null },
    ], 150)).toHaveLength(0)
  })

  it('devolve o raio atual de cada posto para o histórico', () => {
    expect(selecionarParaAjuste([{ ...base, raio_m: 600 }], 150)[0]).toMatchObject({ id: '1', raioAtual: 600 })
  })
})

describe('raioAlvoValido', () => {
  it('aceita só os alvos oferecidos', () => {
    expect(raioAlvoValido(150)).toBe(true)
    expect(raioAlvoValido(100)).toBe(true)
    expect(raioAlvoValido(30)).toBe(false)
    expect(raioAlvoValido(500)).toBe(false)
    expect(raioAlvoValido('150')).toBe(false)
  })
})
