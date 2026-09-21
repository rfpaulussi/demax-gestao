import { describe, it, expect } from 'vitest'
import {
  hhmmParaMin, minParaHHMM, fmtDataBR, fmtAcrescimo, fmtHoraCurta,
  fmtHorasTotal, fmtDatasComPrefixo, diaSemanaDe, addDias, mesDe, addMeses,
} from './tempo'

describe('tempo', () => {
  it('converte HH:MM <-> minutos (aceita HH:MM:SS)', () => {
    expect(hhmmParaMin('07:00:00')).toBe(420)
    expect(hhmmParaMin('13:12')).toBe(792)
    expect(minParaHHMM(528)).toBe('08:48')
    expect(minParaHHMM(60)).toBe('01:00')
  })

  it('formata datas e horas', () => {
    expect(fmtDataBR('2026-06-28')).toBe('28/06/2026')
    expect(fmtAcrescimo(60)).toBe('01:00h')
    expect(fmtHoraCurta('15:00')).toBe('15h')
    expect(fmtHoraCurta('15:30')).toBe('15h30')
    expect(fmtHorasTotal(120)).toBe('02 hora(s)')
    expect(fmtHorasTotal(150)).toBe('02h30min')
  })

  it('lista datas com prefixo e ordena', () => {
    expect(fmtDatasComPrefixo(['2026-06-30'])).toBe('no dia 30/06/2026')
    expect(fmtDatasComPrefixo(['2026-07-01', '2026-06-30'])).toBe('nos dias 30/06/2026 e 01/07/2026')
    expect(fmtDatasComPrefixo(['2026-06-30', '2026-07-01', '2026-07-02']))
      .toBe('nos dias 30/06/2026, 01/07/2026 e 02/07/2026')
  })

  it('calcula dia da semana sem depender do fuso', () => {
    expect(diaSemanaDe('2026-09-21')).toBe('Segunda-feira')
    expect(diaSemanaDe('2026-06-28')).toBe('Domingo')
    expect(diaSemanaDe('2026-06-27')).toBe('Sábado')
  })

  it('soma dias e meses', () => {
    expect(addDias('2026-06-30', 1)).toBe('2026-07-01')
    expect(addDias('2026-03-01', -1)).toBe('2026-02-28')
    expect(mesDe('2026-06-30')).toBe('2026-06')
    expect(addMeses('2026-08-31', 6)).toBe('2027-02-28')
    expect(addMeses('2026-06-05', 6)).toBe('2026-12-05')
  })
})
