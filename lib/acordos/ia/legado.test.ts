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

  it('trabalhou a mais e o texto manda repor: sinaliza', () => {
    expect(possivelmenteInvertido({ ...base, trabalhou_a_mais: true, direcao_texto: 'reposicao' })).toBe(true)
  })

  it('trabalhou a mais e descansa: ok; quem não trabalhou e repõe: ok', () => {
    expect(possivelmenteInvertido({ ...base, trabalhou_a_mais: true, direcao_texto: 'descanso' })).toBe(false)
    expect(possivelmenteInvertido({ ...base, trabalhou_a_mais: false, direcao_texto: 'reposicao' })).toBe(false)
  })
})
