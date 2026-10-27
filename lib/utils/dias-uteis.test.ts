import { describe, it, expect } from 'vitest'
import { diasUteisNoPeriodo, toDate } from './dias-uteis'

const nenhum = new Set<string>()
const ini = toDate('2026-11-01')
const fim = toDate('2026-11-30')

describe('diasUteisNoPeriodo por regime', () => {
  it('5x2: só segunda a sexta', () => {
    expect(diasUteisNoPeriodo(ini, fim, '5x2', nenhum)).toBe(21)
  })
  it('5x1: projeta 5 dias de trabalho + 1 de folga a partir do início do período', () => {
    expect(diasUteisNoPeriodo(ini, fim, '5x1', nenhum)).toBe(25)
  })
  it('5x1: feriado não conta', () => {
    expect(diasUteisNoPeriodo(ini, fim, '5x1', new Set(['2026-11-02']))).toBe(24)
  })
  it('6x1: segunda a sábado, domingo é folga', () => {
    expect(diasUteisNoPeriodo(ini, fim, '6x1', nenhum)).toBe(25)
  })
  it('12x36: dias corridos', () => {
    expect(diasUteisNoPeriodo(ini, fim, '12x36', nenhum)).toBe(30)
  })
})
