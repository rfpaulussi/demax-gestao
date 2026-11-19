// lib/absenteismo/parametros.test.ts
import { describe, it, expect } from 'vitest'
import { anosDisponiveis, lerParametros, montarQuery } from './parametros'

const HOJE = '2026-11-19'

describe('lerParametros', () => {
  it('sem parâmetros: mês e ano de hoje, sem filtros', () => {
    expect(lerParametros({}, HOJE)).toEqual({
      ano: 2026, mes: 11, filtros: { secretaria: null, posto_id: null, supervisor_id: null },
    })
  })
  it('mês válido e ano válido são respeitados', () => {
    expect(lerParametros({ mes: '8', ano: '2026' }, HOJE)).toMatchObject({ ano: 2026, mes: 8 })
  })
  it('mês inválido cai no mês de hoje; mês futuro é limitado ao mês de hoje', () => {
    expect(lerParametros({ mes: '13' }, HOJE).mes).toBe(11)
    expect(lerParametros({ mes: 'abc' }, HOJE).mes).toBe(11)
    expect(lerParametros({ mes: '12' }, HOJE).mes).toBe(11)
  })
  it('ano fora de 2026..ano de hoje cai no ano de hoje', () => {
    expect(lerParametros({ ano: '2025' }, HOJE).ano).toBe(2026)
    expect(lerParametros({ ano: '2030' }, HOJE).ano).toBe(2026)
  })
  it('ano passado sem mês usa dezembro', () => {
    expect(lerParametros({ ano: '2026' }, '2027-02-10')).toMatchObject({ ano: 2026, mes: 12 })
  })
  it('filtros: aparam espaços, vazio vira null, array pega o primeiro', () => {
    expect(lerParametros({ secretaria: ' SME ', posto: '', supervisor: ['s1', 's2'] }, HOJE).filtros).toEqual({
      secretaria: 'SME', posto_id: null, supervisor_id: 's1',
    })
  })
})

describe('montarQuery', () => {
  const p = lerParametros({ secretaria: 'SME', posto: 'p1' }, HOJE)
  it('inclui só o que está preenchido', () => {
    expect(montarQuery(p)).toBe('mes=11&ano=2026&secretaria=SME&posto=p1')
  })
  it('sobrescrever troca ou remove um filtro', () => {
    expect(montarQuery(p, { secretaria: 'SMEL' })).toBe('mes=11&ano=2026&secretaria=SMEL&posto=p1')
    expect(montarQuery(p, { posto_id: null })).toBe('mes=11&ano=2026&secretaria=SME')
  })
})

describe('anosDisponiveis', () => {
  it('de 2026 até o ano de hoje', () => {
    expect(anosDisponiveis('2026-11-19')).toEqual([2026])
    expect(anosDisponiveis('2028-01-05')).toEqual([2026, 2027, 2028])
  })
})
