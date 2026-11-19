// lib/absenteismo/periodos.test.ts
import { describe, it, expect } from 'vitest'
import { periodoAnoAnterior, periodoAnterior } from './periodos'

const DESDE = '2026-06-18'

describe('periodoAnterior', () => {
  it('mês corrente parcial (1 a 19/11): compara com 1 a 19/10', () => {
    expect(periodoAnterior({ inicio: '2026-11-01', fim: '2026-11-19' }, 2026, 11, DESDE, '2026-11-19'))
      .toEqual({ inicio: '2026-10-01', fim: '2026-10-19' })
  })
  it('mês cheio: compara com o mês anterior inteiro', () => {
    expect(periodoAnterior({ inicio: '2026-10-01', fim: '2026-10-31' }, 2026, 10, DESDE, '2026-11-19'))
      .toEqual({ inicio: '2026-09-01', fim: '2026-09-30' })
  })
  it('mês anterior que começa antes de 18/06 não tem base completa', () => {
    expect(periodoAnterior({ inicio: '2026-07-01', fim: '2026-07-31' }, 2026, 7, DESDE, '2026-11-19')).toBeNull()
  })
  it('mês parcial por dadosDesde (junho) não tem anterior', () => {
    expect(periodoAnterior({ inicio: '2026-06-18', fim: '2026-06-30' }, 2026, 6, DESDE, '2026-11-19')).toBeNull()
  })
  it('atravessa a virada de ano', () => {
    expect(periodoAnterior({ inicio: '2027-01-01', fim: '2027-01-31' }, 2027, 1, DESDE, '2027-03-01'))
      .toEqual({ inicio: '2026-12-01', fim: '2026-12-31' })
  })
})

describe('periodoAnoAnterior', () => {
  it('sem dados do ano passado hoje: null', () => {
    expect(periodoAnoAnterior({ inicio: '2026-11-01', fim: '2026-11-19' }, 2026, 11, DESDE, '2026-11-19')).toBeNull()
  })
  it('quando existir base (jul/2027 comparado a jul/2026): corta no mesmo dia', () => {
    expect(periodoAnoAnterior({ inicio: '2027-07-01', fim: '2027-07-10' }, 2027, 7, DESDE, '2027-07-10'))
      .toEqual({ inicio: '2026-07-01', fim: '2026-07-10' })
  })
  it('mês cheio de 2027 com base completa em 2026', () => {
    expect(periodoAnoAnterior({ inicio: '2027-08-01', fim: '2027-08-31' }, 2027, 8, DESDE, '2027-09-05'))
      .toEqual({ inicio: '2026-08-01', fim: '2026-08-31' })
  })
})
