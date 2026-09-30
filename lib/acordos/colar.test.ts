import { describe, expect, it } from 'vitest'
import { interpretarPlanilha } from './colar'

const fs = [
  { id: '1', nome: 'Amanda Gonçalves' },
  { id: '2', nome: 'Marília Rosana do Patrocínio' },
  { id: '3', nome: 'Priscila Aparecida dos Santos Matsuo Coelho' },
  { id: '4', nome: 'Richard Searles' },
]
const EV = '2026-10-04'

describe('interpretarPlanilha', () => {
  it('lê horário, nome e folgas de linhas com TAB (colunas da planilha)', () => {
    const r = interpretarPlanilha(
      'CEMPRE X\t08h às 12:30h\tAmanda Gonçalves\t23/12\nCEMPRE X\t08h às 18h\tMarília Rosana do Patrocínio\t28/12 e 29/12', fs, EV)
    expect(r.problemas).toEqual([])
    expect(r.participantes['1']).toEqual({ inicio: '08:00', fim: '12:30', folgas: ['2026-12-23'] })
    expect(r.participantes['2']).toEqual({ inicio: '08:00', fim: '18:00', folgas: ['2026-12-28', '2026-12-29'] })
  })

  it('folga em janeiro cai no ano seguinte; nome cortado na planilha casa por prefixo', () => {
    const r = interpretarPlanilha('Mario Portes\t08h às 12:30h\tPriscila Aparecida dos Santos Matsuo Coelh\t04/01', fs, EV)
    expect(r.participantes['3']).toEqual({ inicio: '08:00', fim: '12:30', folgas: ['2027-01-04'] })
  })

  it('aceita "21/12." com ponto e 13:30h às 18h', () => {
    const r = interpretarPlanilha('Escola\t13:30h às 18h\tRichard Searles\t21/12.', fs, EV)
    expect(r.participantes['4']).toEqual({ inicio: '13:30', fim: '18:00', folgas: ['2026-12-21'] })
  })

  it('linha sem tabulação: acha o nome dentro do texto', () => {
    const r = interpretarPlanilha('Escola 08h às 12:30h Amanda Gonçalves 22/12', fs, EV)
    expect(r.participantes['1'].folgas).toEqual(['2026-12-22'])
  })

  it('reporta nome não encontrado, sem horário e sem data', () => {
    const r = interpretarPlanilha('x\t08h às 12h\tFulano de Tal\t22/12\nx\tAmanda Gonçalves\t22/12\nx\t08h às 12h\tAmanda Gonçalves', fs, EV)
    expect(Object.keys(r.participantes)).toEqual([])
    expect(r.problemas).toHaveLength(3)
  })
})
