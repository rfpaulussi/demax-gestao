// lib/absenteismo/datas.test.ts
import { describe, it, expect } from 'vitest'
import { addDias, diffDias, listarDias, diaSemana, periodoDoMes, mesAnterior, maxData, minData } from './datas'

describe('datas', () => {
  it('addDias atravessa mês e ano', () => {
    expect(addDias('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDias('2026-11-01', -1)).toBe('2026-10-31')
  })
  it('diffDias é fim menos início', () => {
    expect(diffDias('2026-11-01', '2026-11-30')).toBe(29)
    expect(diffDias('2026-11-05', '2026-11-05')).toBe(0)
  })
  it('listarDias inclui os dois extremos', () => {
    expect(listarDias('2026-11-28', '2026-12-01')).toEqual(['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01'])
    expect(listarDias('2026-11-05', '2026-11-04')).toEqual([])
  })
  it('diaSemana: 2026-11-02 é segunda (1) e 2026-11-01 é domingo (0)', () => {
    expect(diaSemana('2026-11-02')).toBe(1)
    expect(diaSemana('2026-11-01')).toBe(0)
  })
  it('periodoDoMes e mesAnterior', () => {
    expect(periodoDoMes(2026, 11)).toEqual({ inicio: '2026-11-01', fim: '2026-11-30' })
    expect(periodoDoMes(2026, 2)).toEqual({ inicio: '2026-02-01', fim: '2026-02-28' })
    expect(mesAnterior(2026, 1)).toEqual({ ano: 2025, mes: 12 })
    expect(mesAnterior(2026, 11)).toEqual({ ano: 2026, mes: 10 })
  })
  it('maxData e minData', () => {
    expect(maxData('2026-11-01', '2026-11-02')).toBe('2026-11-02')
    expect(minData('2026-11-01', '2026-11-02')).toBe('2026-11-01')
  })
})
