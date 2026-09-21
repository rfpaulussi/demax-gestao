import { describe, it, expect } from 'vitest'
import {
  montarSemana, jornadaDiaMin, totalSemanalMin, semanaParaTexto, assinaturaSemana,
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
