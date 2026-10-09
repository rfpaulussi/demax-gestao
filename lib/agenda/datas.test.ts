import { describe, it, expect } from 'vitest'
import { diasDaSemana, ehDiaUtil, rotuloSemana, segundaDe } from './datas'
import { slotsDaSemana, SLOTS_MIN } from './tema'
import { feriadosParaAno } from '../calendario/feriados-mogi'

describe('semana útil da agenda', () => {
  it('tem 5 dias (segunda a sexta), sem sábado', () => {
    expect(diasDaSemana('2026-10-12')).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'])
  })

  it('segundaDe devolve a segunda-feira da semana', () => {
    expect(segundaDe('2026-10-09')).toBe('2026-10-05') // sexta
    expect(segundaDe('2026-10-11')).toBe('2026-10-05') // domingo
    expect(segundaDe('2026-10-12')).toBe('2026-10-12') // segunda
  })

  it('ehDiaUtil é verdadeiro só de segunda a sexta', () => {
    expect(ehDiaUtil('2026-10-12')).toBe(true) // segunda
    expect(ehDiaUtil('2026-10-16')).toBe(true) // sexta
    expect(ehDiaUtil('2026-10-17')).toBe(false) // sábado
    expect(ehDiaUtil('2026-10-18')).toBe(false) // domingo
  })

  it('o rótulo da semana vai de segunda a sexta', () => {
    expect(rotuloSemana('2026-10-12')).toBe('12 out – 16 out')
  })

  it('a meta de visitas desconta os feriados de lei', () => {
    expect(slotsDaSemana(0)).toBe(5 * 2 * SLOTS_MIN)
    expect(slotsDaSemana(1)).toBe(4 * 2 * SLOTS_MIN)
    expect(slotsDaSemana(9)).toBe(0)
  })
})

describe('feriados de Mogi usados pela agenda', () => {
  const f = feriadosParaAno(2026)
  const por = (d: string) => f.find(x => x.data === d)

  it('12/10 (Nossa Senhora Aparecida) é feriado nacional numa segunda-feira', () => {
    expect(por('2026-10-12')?.tipo).toBe('nacional')
    expect(ehDiaUtil('2026-10-12')).toBe(true)
  })

  it('30/10 (Dia do Servidor) é só ponto facultativo — não bloqueia o planejamento', () => {
    expect(por('2026-10-30')?.tipo).toBe('facultativo')
  })
})
