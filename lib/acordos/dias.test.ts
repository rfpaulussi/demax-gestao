import { describe, it, expect } from 'vitest'
import { sugerirQuantidadeDias, proximosDiasUteis } from './dias'
import { func } from './__fixtures__'

describe('sugerirQuantidadeDias', () => {
  it('escolhe o menor número de dias que divide exato e respeita o máximo por dia', () => {
    expect(sugerirQuantidadeDias(528, 72)).toBe(8)   // 66 min/dia
    expect(sugerirQuantidadeDias(120, 60)).toBe(2)   // 60 min/dia
  })

  it('devolve null quando não existe divisão possível', () => {
    expect(sugerirQuantidadeDias(100, 3)).toBeNull()
  })
})

describe('proximosDiasUteis', () => {
  const f1 = func('a')

  it('pula fim de semana', () => {
    expect(proximosDiasUteis('2026-06-05', 3, [f1], new Map())).toEqual(['2026-06-08', '2026-06-09', '2026-06-10'])
  })

  it('pula feriados e pontos facultativos do calendário', () => {
    const feriados = new Map([['2026-06-09', { nome: 'Ponto facultativo', tipo: 'facultativo' }]])
    expect(proximosDiasUteis('2026-06-05', 3, [f1], feriados)).toEqual(['2026-06-08', '2026-06-10', '2026-06-11'])
  })
})
