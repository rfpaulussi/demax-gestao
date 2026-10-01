import { describe, expect, it } from 'vitest'
import { interpretarPlanilha } from './colar'

const fs = [
  { id: '1', nome: 'Amanda Gonçalves' },
  { id: '2', nome: 'Marília Rosana do Patrocínio' },
  { id: '3', nome: 'Priscila Aparecida dos Santos Matsuo Coelho' },
  { id: '4', nome: 'Richard Searles' },
]

describe('interpretarPlanilha', () => {
  it('colunas Funcionário / Início / Fim / Folga 1 / Folga 2, só números no horário', () => {
    const r = interpretarPlanilha(
      'Amanda Gonçalves\t8\t12:30\t23/12/2026\t\nMarília Rosana do Patrocínio\t8:00\t1800\t28/12/2026\t29/12/2026', fs)
    expect(r.problemas).toEqual([])
    expect(r.participantes['1']).toEqual({ inicio: '08:00', fim: '12:30', folgas: ['2026-12-23'] })
    expect(r.participantes['2']).toEqual({ inicio: '08:00', fim: '18:00', folgas: ['2026-12-28', '2026-12-29'] })
  })

  it('aceita 13h30, 0830 e 18', () => {
    const r = interpretarPlanilha('Richard Searles\t13h30\t18\t21/12/2026\nAmanda Gonçalves\t0830\t1215\t22/12/2026', fs)
    expect(r.participantes['4']).toMatchObject({ inicio: '13:30', fim: '18:00' })
    expect(r.participantes['1']).toMatchObject({ inicio: '08:30', fim: '12:15' })
  })

  it('a coluna da escola na frente não atrapalha; nome cortado casa por prefixo', () => {
    const r = interpretarPlanilha('Mario Portes\tPriscila Aparecida dos Santos Matsuo Coelh\t8\t12:30\t04/01/2027', fs)
    expect(r.participantes['3']).toEqual({ inicio: '08:00', fim: '12:30', folgas: ['2027-01-04'] })
  })

  it('também aceita o horário num texto só ("08h às 12:30h")', () => {
    const r = interpretarPlanilha('Escola\t08h às 12:30h\tAmanda Gonçalves\t23/12/2026', fs)
    expect(r.participantes['1']).toEqual({ inicio: '08:00', fim: '12:30', folgas: ['2026-12-23'] })
  })

  it('data sem ano vira problema (não chuta o ano)', () => {
    const r = interpretarPlanilha('Amanda Gonçalves\t8\t12:30\t23/12', fs)
    expect(r.participantes).toEqual({})
    expect(r.problemas[0]).toMatch(/com o ano/)
  })

  it('reporta nome não encontrado, sem horário e sem data; data impossível', () => {
    const r = interpretarPlanilha(
      'Fulano de Tal\t8\t12\t22/12/2026\nAmanda Gonçalves\t22/12/2026\nAmanda Gonçalves\t8\t12\nAmanda Gonçalves\t8\t12\t31/02/2026', fs)
    expect(r.participantes).toEqual({})
    expect(r.problemas).toHaveLength(4)
  })
})

import { parseHora } from './colar'

describe('parseHora', () => {
  it('aceita 8, 8:15, 9, 815, 0830, 8h30, 18 e recusa lixo', () => {
    expect(['8', '8:15', '9', '815', '0830', '8h30', '18', '12:30h', '1800'].map(parseHora))
      .toEqual(['08:00', '08:15', '09:00', '08:15', '08:30', '08:30', '18:00', '12:30', '18:00'])
    expect(['', '25', '8:75', 'abc', '99:99'].map(parseHora)).toEqual([null, null, null, null, null])
  })
})
