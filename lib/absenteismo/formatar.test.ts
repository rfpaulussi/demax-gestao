// lib/absenteismo/formatar.test.ts
import { describe, it, expect } from 'vitest'
import { fmtDataBR, fmtDec, fmtInt, fmtPct, fmtPeriodo, fmtVariacaoPct, fmtVariacaoPp, rotuloMes } from './formatar'

describe('formatar', () => {
  it('fmtPct usa vírgula e 2 casas por padrão', () => {
    expect(fmtPct(1.784)).toBe('1,78%')
    expect(fmtPct(0)).toBe('0,00%')
    expect(fmtPct(12.5, 1)).toBe('12,5%')
  })
  it('fmtInt usa ponto de milhar e arredonda', () => {
    expect(fmtInt(10613)).toBe('10.613')
    expect(fmtInt(870.8)).toBe('871')
  })
  it('fmtDec fixa as casas', () => {
    expect(fmtDec(1.94, 1)).toBe('1,9')
    expect(fmtDec(3, 1)).toBe('3,0')
  })
  it('fmtVariacaoPct: sinal, 1 casa, null vira traço', () => {
    expect(fmtVariacaoPct(-9.44)).toBe('−9,4%')
    expect(fmtVariacaoPct(12.25)).toBe('+12,3%')
    expect(fmtVariacaoPct(0)).toBe('0,0%')
    expect(fmtVariacaoPct(null)).toBe('—')
  })
  it('fmtVariacaoPp: pontos percentuais, 2 casas', () => {
    expect(fmtVariacaoPp(-0.4)).toBe('−0,40 p.p.')
    expect(fmtVariacaoPp(1.9)).toBe('+1,90 p.p.')
    expect(fmtVariacaoPp(null)).toBe('—')
  })
  it('valores não finitos viram traço', () => {
    expect(fmtVariacaoPct(NaN)).toBe('—')
    expect(fmtVariacaoPct(Infinity)).toBe('—')
    expect(fmtVariacaoPp(NaN)).toBe('—')
  })
  it('rotuloMes e datas', () => {
    expect(rotuloMes('2026-11')).toBe('nov/26')
    expect(rotuloMes('2026-01')).toBe('jan/26')
    expect(fmtDataBR('2026-11-19')).toBe('19/11/2026')
    expect(fmtPeriodo('2026-11-01', '2026-11-19')).toBe('01/11/2026 a 19/11/2026')
  })
})
