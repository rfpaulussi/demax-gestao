import { describe, it, expect } from 'vitest'
import {
  montarSemana, jornadaDiaMin, totalSemanalMin, semanaParaTexto, assinaturaSemana,
  saidaDoDia, minutosAposHorario, minutosForaDoHorario, juntarRotulos,
  TURNO_PADRAO, type TurnoRow,
} from './horario-do-turno'

const turno5x2c: TurnoRow = {
  tipo_escala: '5x2', hora_entrada: '07:00:00', hora_saida_seg_qui: '17:00:00', hora_saida_sex: null,
  hora_inicio_almoco: '12:00:00', hora_fim_almoco: '13:12:00',
}

describe('montarSemana', () => {
  it('5x2 com almoço 12:00-13:12 fecha 44h e folga no fim de semana', () => {
    const s = montarSemana(turno5x2c)
    expect(jornadaDiaMin(s['Segunda-feira'])).toBe(528)
    expect(totalSemanalMin(s)).toBe(2640)
    expect(s['Sábado'].folga).toBe(true)
    expect(s['Domingo'].folga).toBe(true)
    expect(semanaParaTexto(s)['Segunda-feira']).toBe('07:00 às 12:00 / 13:12 às 17:00')
    expect(semanaParaTexto(s)['Sábado']).toBe('FOLGA')
  })

  it('5x2 com sexta mais curta', () => {
    const s = montarSemana({
      ...turno5x2c, hora_inicio_almoco: '12:00', hora_fim_almoco: '13:00', hora_saida_sex: '16:00',
    })
    expect(jornadaDiaMin(s['Quinta-feira'])).toBe(540)
    expect(jornadaDiaMin(s['Sexta-feira'])).toBe(480)
    expect(totalSemanalMin(s)).toBe(2640)
  })

  it('5x1 trabalha de segunda a sábado e folga no domingo', () => {
    const s = montarSemana({
      tipo_escala: '5x1', hora_entrada: '07:00', hora_saida_seg_qui: '15:20', hora_saida_sex: null,
      hora_inicio_almoco: '11:00', hora_fim_almoco: '12:00',
    })
    expect(jornadaDiaMin(s['Sábado'])).toBe(440)
    expect(s['Domingo'].folga).toBe(true)
    expect(totalSemanalMin(s)).toBe(2640)
  })

  it('usa horário próprio de sábado quando existe', () => {
    const s = montarSemana({
      ...turno5x2c, hora_entrada_sabado: '07:00', hora_saida_sabado: '11:00',
      hora_inicio_almoco_sabado: null, hora_fim_almoco_sabado: null,
    })
    expect(s['Sábado'].folga).toBe(false)
    expect(jornadaDiaMin(s['Sábado'])).toBe(240)
    expect(semanaParaTexto(s)['Sábado']).toBe('07:00 às 11:00')
  })

  it('turno sem almoço vira um período só', () => {
    const s = montarSemana({
      tipo_escala: '5x2', hora_entrada: '07:00', hora_saida_seg_qui: '13:00', hora_saida_sex: null,
      hora_inicio_almoco: null, hora_fim_almoco: null,
    })
    expect(s['Segunda-feira']).toMatchObject({ e1: '07:00', s1: '13:00', e2: '', s2: '' })
    expect(jornadaDiaMin(s['Segunda-feira'])).toBe(360)
  })

  it('TURNO_PADRAO fecha 44h e assinatura é estável', () => {
    expect(totalSemanalMin(montarSemana(TURNO_PADRAO))).toBe(2640)
    expect(assinaturaSemana(montarSemana(TURNO_PADRAO))).toBe(assinaturaSemana(montarSemana({ ...TURNO_PADRAO })))
  })
})

describe('saidaDoDia / minutosAposHorario / minutosForaDoHorario', () => {
  const d = montarSemana(turno5x2c)['Segunda-feira'] // 07:00–12:00 / 13:12–17:00
  const folga = montarSemana(turno5x2c)['Domingo']

  it('saidaDoDia devolve a última saída ou vazio na folga', () => {
    expect(saidaDoDia(d)).toBe('17:00')
    expect(saidaDoDia(folga)).toBe('')
    expect(saidaDoDia({ folga: false, e1: '07:00', s1: '13:00', e2: '', s2: '' })).toBe('13:00')
  })

  it('minutosAposHorario conta só o tempo trabalhado dali até o fim', () => {
    expect(minutosAposHorario(d, '14:00')).toBe(180)
    expect(minutosAposHorario(d, '11:00')).toBe(60 + 228)
    expect(minutosAposHorario(d, '12:30')).toBe(228)
    expect(minutosAposHorario(d, '17:30')).toBe(0)
    expect(minutosAposHorario(d, '06:00')).toBe(528)
    expect(minutosAposHorario(folga, '08:00')).toBe(0)
  })

  it('minutosForaDoHorario desconta a sobreposição com os períodos trabalhados', () => {
    expect(minutosForaDoHorario(d, '08:00', '20:00')).toBe(252)
    expect(minutosForaDoHorario(d, '08:00', '10:00')).toBe(0)
    expect(minutosForaDoHorario(d, '17:00', '19:00')).toBe(120)
    expect(minutosForaDoHorario(d, '12:00', '13:12')).toBe(72)
    expect(minutosForaDoHorario(folga, '08:00', '12:00')).toBe(240)
    expect(minutosForaDoHorario(d, '10:00', '08:00')).toBe(0)
  })
})

describe('juntarRotulos', () => {
  it('junta rótulos de turno em português', () => {
    expect(juntarRotulos(['Turno A'])).toBe('Turno A')
    expect(juntarRotulos(['Turno A', 'Turno C'])).toBe('Turno A e Turno C')
    expect(juntarRotulos(['Turno A', 'Turno B', 'Turno C'])).toBe('Turno A, Turno B e Turno C')
  })
})
