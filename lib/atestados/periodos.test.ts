import { describe, it, expect } from 'vitest'
import { atestadosConflitam, diasUnicosAtestados } from './periodos'

const p = (data_inicio: string, data_fim: string | null) => ({ data_inicio, data_fim })

describe('atestadosConflitam', () => {
  it('passagem de bastão em um dia não conflita (nos dois sentidos)', () => {
    expect(atestadosConflitam(p('2026-09-02', '2026-09-04'), p('2026-09-04', '2026-09-13'))).toBe(false)
    expect(atestadosConflitam(p('2026-09-04', '2026-09-13'), p('2026-09-02', '2026-09-04'))).toBe(false)
  })
  it('sem nenhum dia em comum não conflita', () => {
    expect(atestadosConflitam(p('2026-09-02', '2026-09-03'), p('2026-09-04', '2026-09-13'))).toBe(false)
  })
  it('sobreposição de 2+ dias conflita', () => {
    expect(atestadosConflitam(p('2026-09-04', '2026-09-18'), p('2026-09-17', '2026-10-16'))).toBe(true)
    expect(atestadosConflitam(p('2026-09-02', '2026-09-15'), p('2026-09-13', '2026-09-19'))).toBe(true)
  })
  it('um dentro do outro conflita, mesmo tocando a fronteira', () => {
    expect(atestadosConflitam(p('2026-06-30', '2026-07-24'), p('2026-07-16', '2026-07-16'))).toBe(true)
    expect(atestadosConflitam(p('2026-09-02', '2026-09-04'), p('2026-09-04', '2026-09-04'))).toBe(true)
    expect(atestadosConflitam(p('2026-09-04', '2026-09-13'), p('2026-09-04', '2026-09-04'))).toBe(true)
  })
  it('iguais conflitam, inclusive de 1 dia', () => {
    expect(atestadosConflitam(p('2026-08-13', '2026-08-13'), p('2026-08-13', '2026-08-13'))).toBe(true)
    expect(atestadosConflitam(p('2026-08-24', '2026-11-21'), p('2026-08-24', '2026-11-22'))).toBe(true)
  })
  it('data_fim nula vale 1 dia', () => {
    expect(atestadosConflitam(p('2026-09-04', null), p('2026-09-04', '2026-09-13'))).toBe(true)
  })
})

describe('diasUnicosAtestados', () => {
  it('dia compartilhado conta uma vez', () => {
    expect(diasUnicosAtestados([p('2026-09-02', '2026-09-04'), p('2026-09-04', '2026-09-13')])).toBe(12)
  })
  it('sem sobreposição soma normal', () => {
    expect(diasUnicosAtestados([p('2026-09-02', '2026-09-03'), p('2026-09-14', '2026-09-17')])).toBe(6)
  })
  it('um dentro do outro não duplica', () => {
    expect(diasUnicosAtestados([p('2026-06-30', '2026-07-24'), p('2026-07-16', '2026-07-16')])).toBe(25)
  })
  it('vazio e data_fim nula', () => {
    expect(diasUnicosAtestados([])).toBe(0)
    expect(diasUnicosAtestados([p('2026-09-04', null)])).toBe(1)
  })
})
