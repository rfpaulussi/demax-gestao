import { describe, it, expect } from 'vitest'
import { lerLegado, possivelmenteInvertido, type ClassificacaoLegado } from './legado'

describe('lerLegado', () => {
  it('lê os campos e descarta o que não tem o formato esperado', () => {
    const r = lerLegado({ situacao: 'T1', direcao_texto: 'reposicao', trabalhou_a_mais: true, data_evento: '2026-06-20', data_folga: '20/06/2026', resumo: 'x' })!
    expect(r).toMatchObject({ situacao: 'T1', direcao_texto: 'reposicao', trabalhou_a_mais: true, data_evento: '2026-06-20', data_folga: null })
    expect(lerLegado(null)).toBeNull()
    expect(lerLegado({ situacao: 'T9', direcao_texto: 'sei-la' })).toMatchObject({ situacao: null, direcao_texto: 'indefinida', trabalhou_a_mais: false })
  })
})

describe('possivelmenteInvertido', () => {
  const base: ClassificacaoLegado = {
    situacao: 'T1', direcao_texto: 'indefinida', trabalhou_a_mais: false, data_evento: null, data_folga: null, tem_campos_em_branco: false, resumo: '',
  }

  it('T1 ou T5 com direção "reposição": é o bug conhecido do T1 antigo, sinaliza', () => {
    expect(possivelmenteInvertido({ ...base, situacao: 'T1', direcao_texto: 'reposicao' })).toBe(true)
    expect(possivelmenteInvertido({ ...base, situacao: 'T5', direcao_texto: 'reposicao' })).toBe(true)
  })

  it('T2/T3/T4 usam acréscimo por definição: "reposição" neles nunca é inversão', () => {
    for (const situacao of ['T2', 'T3', 'T4'] as const) {
      expect(possivelmenteInvertido({ ...base, situacao, trabalhou_a_mais: true, direcao_texto: 'reposicao' })).toBe(false)
    }
  })

  it('banco de horas com folga marcada (T4) não é inversão, mesmo com acréscimo', () => {
    expect(possivelmenteInvertido({ ...base, situacao: 'T4', trabalhou_a_mais: true, direcao_texto: 'reposicao', data_folga: '2026-08-31' })).toBe(false)
  })

  it('T1/T5 que já descansam (direção correta) não são sinalizados', () => {
    expect(possivelmenteInvertido({ ...base, situacao: 'T1', direcao_texto: 'descanso' })).toBe(false)
    expect(possivelmenteInvertido({ ...base, situacao: 'T5', direcao_texto: 'descanso' })).toBe(false)
  })

  it('sem situação identificada, não sinaliza (falta de dado, não inversão)', () => {
    expect(possivelmenteInvertido({ ...base, situacao: null, direcao_texto: 'reposicao' })).toBe(false)
  })
})
