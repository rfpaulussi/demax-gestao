import { describe, it, expect } from 'vitest'
import { pascoa } from './pascoa'
import { gerarFeriadosDoAno, feriadosParaAno, FACULTATIVOS_2026 } from './feriados-mogi'

describe('pascoa', () => {
  it('calcula a Páscoa', () => {
    expect(pascoa(2025)).toBe('2025-04-20')
    expect(pascoa(2026)).toBe('2026-04-05')
    expect(pascoa(2027)).toBe('2027-03-28')
    expect(pascoa(2028)).toBe('2028-04-16')
  })
})

describe('feriados de Mogi', () => {
  const f2026 = gerarFeriadosDoAno(2026)

  it('inclui feriados nacionais, estadual e os 3 municipais', () => {
    expect(f2026).toHaveLength(13)
    const por = (d: string) => f2026.find(f => f.data === d)
    expect(por('2026-04-03')?.tipo).toBe('municipal')
    expect(por('2026-07-26')?.tipo).toBe('municipal')
    expect(por('2026-09-01')?.tipo).toBe('municipal')
    expect(por('2026-07-09')?.tipo).toBe('estadual')
    expect(por('2026-11-20')?.tipo).toBe('nacional')
    expect(por('2026-12-25')?.tipo).toBe('nacional')
  })

  it('não trata Carnaval, Corpus Christi, 25/01 nem 26/06 como feriado', () => {
    const datas = new Set(f2026.map(f => f.data))
    for (const d of ['2026-02-16', '2026-02-17', '2026-06-04', '2026-01-25', '2026-06-26']) {
      expect(datas.has(d)).toBe(false)
    }
  })

  it('facultativos 2026 só entram em 2026', () => {
    expect(FACULTATIVOS_2026).toHaveLength(10)
    expect(feriadosParaAno(2026)).toHaveLength(23)
    expect(feriadosParaAno(2027)).toHaveLength(13)
    const cinzas = FACULTATIVOS_2026.find(f => f.data === '2026-02-18')
    expect(cinzas?.ate_hora).toBe('13:00')
    expect(cinzas?.tipo).toBe('facultativo')
  })
})
