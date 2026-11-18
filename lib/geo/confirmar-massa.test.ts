import { describe, it, expect } from 'vitest'
import { limiteValido, selecionarConfirmaveis, type LinhaConfirmavel } from './confirmar-massa'

const futuro = new Date(Date.now() + 5 * 86_400_000).toISOString()
const passado = new Date(Date.now() - 5 * 86_400_000).toISOString()

// ~0,00045° de latitude ≈ 50 m
const base: LinhaConfirmavel = {
  id: '1', nome: 'A', latitude: -23.5, longitude: -46.2, geo_confirmado: false,
  geo_google_lat: -23.5, geo_google_lng: -46.2, geo_google_tipo: 'ROOFTOP', geo_google_parcial: false, geo_google_expira_em: futuro,
}

describe('selecionarConfirmaveis', () => {
  it('pino em cima do endereço do Google entra', () => {
    expect(selecionarConfirmaveis([base], 50).map(c => c.id)).toEqual(['1'])
  })

  it('respeita o limite de distância', () => {
    const perto = { ...base, id: 'p', geo_google_lat: -23.50020 } // ~22 m
    const longe = { ...base, id: 'l', geo_google_lat: -23.50085 } // ~94 m
    expect(selecionarConfirmaveis([perto, longe], 50).map(c => c.id)).toEqual(['p'])
    expect(selecionarConfirmaveis([perto, longe], 100).map(c => c.id).sort()).toEqual(['l', 'p'])
  })

  it('não inclui quem já está confirmado, sem pino ou sem sugestão', () => {
    const r = selecionarConfirmaveis([
      { ...base, id: 'c', geo_confirmado: true },
      { ...base, id: 's', latitude: null, longitude: null },
      { ...base, id: 'g', geo_google_lat: null, geo_google_lng: null },
    ], 100)
    expect(r).toHaveLength(0)
  })

  it('sugestão vencida, imprecisa ou parcial não conta como confirmação', () => {
    const r = selecionarConfirmaveis([
      { ...base, id: 'v', geo_google_expira_em: passado },
      { ...base, id: 'a', geo_google_tipo: 'GEOMETRIC_CENTER' },
      { ...base, id: 'x', geo_google_tipo: 'APPROXIMATE' },
      { ...base, id: 'p', geo_google_parcial: true },
      { ...base, id: 'ok', geo_google_tipo: 'RANGE_INTERPOLATED' },
    ], 100)
    expect(r.map(c => c.id)).toEqual(['ok'])
  })

  it('ordena do mais perto para o mais longe', () => {
    const a = { ...base, id: 'a', geo_google_lat: -23.50030 }
    const b = { ...base, id: 'b', geo_google_lat: -23.50005 }
    expect(selecionarConfirmaveis([a, b], 100).map(c => c.id)).toEqual(['b', 'a'])
  })
})

describe('limiteValido', () => {
  it('aceita inteiros de 10 a 100 e rejeita o resto', () => {
    expect(limiteValido(10)).toBe(true)
    expect(limiteValido(100)).toBe(true)
    expect(limiteValido(9)).toBe(false)
    expect(limiteValido(101)).toBe(false)
    expect(limiteValido(50.5)).toBe(false)
    expect(limiteValido('50')).toBe(false)
    expect(limiteValido(NaN)).toBe(false)
  })
})
