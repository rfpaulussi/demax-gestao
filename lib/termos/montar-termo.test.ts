import { describe, it, expect } from 'vitest'
import { formatarHorario, montarDiffs, tituloDoTermo } from './montar-termo'
import type { HorarioTermo } from './tipos'

const h = (o: Partial<HorarioTermo>): HorarioTermo => ({
  nome: null, escala: null, entrada: null, saidaSegQui: null, entradaSex: null,
  saidaSex: null, almocoInicio: null, almocoFim: null, entradaSab: null, saidaSab: null, ...o,
})

describe('formatarHorario', () => {
  it('devolve traço sem horário', () => {
    expect(formatarHorario(null)).toEqual(['—'])
  })
  it('monta linhas seg-qui, sexta distinta, sábado e almoço', () => {
    const linhas = formatarHorario(h({
      nome: 'Turno 11h (b)', escala: '5x1', entrada: '07:00:00', saidaSegQui: '18:00:00',
      saidaSex: '17:00:00', almocoInicio: '12:00:00', almocoFim: '13:00:00',
    }))
    expect(linhas).toContain('Turno 11h (b) · 5x1')
    expect(linhas).toContain('Seg–Qui: 07:00 às 18:00')
    expect(linhas).toContain('Sexta: 07:00 às 17:00')
    expect(linhas).toContain('Almoço: 12:00 às 13:00')
  })
})

describe('montarDiffs', () => {
  it('marca mudou só onde há diferença e mantém sem alteração', () => {
    const d = montarDiffs({
      posto: { antes: 'A', depois: 'B' },
      secretaria: { antes: 'SMMT', depois: 'SMMT' },
      supervisor: { antes: 'X', depois: 'Y' },
      funcao: { antes: 'AJ', depois: 'AJ' },
      horario: { antes: h({ nome: 'T1', entrada: '07:00', saidaSegQui: '16:00' }), depois: h({ nome: 'T2', entrada: '08:00', saidaSegQui: '17:00' }) },
    })
    const por = Object.fromEntries(d.map(x => [x.rotulo, x.mudou]))
    expect(por['Posto de Trabalho']).toBe(true)
    expect(por['Secretaria']).toBe(false)
    expect(por['Supervisor']).toBe(true)
    expect(por['Função']).toBe(false)
    expect(por['Horário']).toBe(true)
  })
})

describe('tituloDoTermo', () => {
  it('usa transferência quando há posto', () => {
    expect(tituloDoTermo(['transferencia', 'mudanca_horario'])).toBe('TERMO DE TRANSFERÊNCIA DE COLABORADOR')
  })
  it('usa mudança de horário isolada', () => {
    expect(tituloDoTermo(['mudanca_horario'])).toBe('TERMO DE ALTERAÇÃO DE HORÁRIO')
  })
})
