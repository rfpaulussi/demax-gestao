// lib/absenteismo/jornadas.test.ts
import { describe, it, expect } from 'vitest'
import { diasUteisNoPeriodo, toDate } from '@/lib/utils/dias-uteis'
import { diasProgramados, feriadosDoPeriodo } from './jornadas'

const feriados = feriadosDoPeriodo('2026-01-01', '2026-12-31')

describe('feriadosDoPeriodo', () => {
  it('inclui os feriados de Mogi e os nacionais de novembro', () => {
    expect(feriados.has('2026-11-02')).toBe(true)
    expect(feriados.has('2026-11-15')).toBe(true)
    expect(feriados.has('2026-11-20')).toBe(true)
    expect(feriados.has('2026-11-03')).toBe(false)
  })
  it('junta os anos quando o período atravessa a virada', () => {
    const f = feriadosDoPeriodo('2026-12-20', '2027-01-10')
    expect(f.has('2026-12-25')).toBe(true)
    expect(f.has('2027-01-01')).toBe(true)
  })
})

describe('diasProgramados', () => {
  it('5x2 em novembro/2026 tem 19 dias (igual à tela antiga: 19 d.úteis)', () => {
    expect(diasProgramados('5x2', '2026-11-01', '2026-11-30', feriados)).toHaveLength(19)
  })
  it('5x2 ignora sábado, domingo e feriado', () => {
    const d = diasProgramados('5x2', '2026-11-01', '2026-11-30', feriados)
    expect(d).not.toContain('2026-11-02') // feriado (Finados)
    expect(d).not.toContain('2026-11-07') // sábado
    expect(d).not.toContain('2026-11-20') // feriado (Consciência Negra)
    expect(d).toContain('2026-11-03')
  })
  it('período invertido devolve vazio', () => {
    expect(diasProgramados('5x2', '2026-11-10', '2026-11-01', feriados)).toEqual([])
  })

  for (const regime of ['5x2', '5x1', '6x1', '12x36', 'jovem_aprendiz']) {
    it(`paridade com diasUteisNoPeriodo (${regime})`, () => {
      for (const [ini, fim] of [
        ['2026-11-01', '2026-11-30'],
        ['2026-11-16', '2026-11-30'],
        ['2026-10-15', '2026-11-19'],
        ['2026-12-20', '2026-12-31'],
      ]) {
        const esperado = diasUteisNoPeriodo(toDate(ini), toDate(fim), regime, feriados)
        expect(diasProgramados(regime, ini, fim, feriados)).toHaveLength(esperado)
      }
    })
  }
})
