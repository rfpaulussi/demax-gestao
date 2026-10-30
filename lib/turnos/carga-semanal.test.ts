import { describe, it, expect } from 'vitest'
import { avisoCargaSemanal, formatarCargaSemanal } from './carga-semanal'

const base = {
  tipo_escala: '5x2', hora_entrada: '08:00:00', hora_saida_seg_qui: '17:00:00', hora_saida_sex: '17:00:00',
  hora_inicio_almoco: '12:00:00', hora_fim_almoco: '13:00:00',
}

describe('avisoCargaSemanal', () => {
  it('5x2 de 8h/dia fecha só 40h e avisa', () => {
    expect(avisoCargaSemanal(base)).toEqual({ min: 2400, difMin: -240 })
  })

  it('5x2 de 8h48/dia fecha 44h e não avisa', () => {
    expect(avisoCargaSemanal({ ...base, hora_saida_seg_qui: '17:48:00', hora_saida_sex: '17:48:00' })).toBeNull()
  })

  it('5x1 com sábado próprio que fecha 44h não avisa', () => {
    expect(avisoCargaSemanal({
      ...base, tipo_escala: '5x1', hora_saida_sex: null,
      hora_entrada_sabado: '08:00:00', hora_saida_sabado: '12:00:00',
    })).toBeNull()
  })

  it('5x1 acima de 44h avisa com diferença positiva', () => {
    const a = avisoCargaSemanal({ ...base, tipo_escala: '5x1', hora_saida_sex: null, hora_saida_seg_qui: '16:48:00' })
    expect(a?.min).toBe(2808)
    expect(a?.difMin).toBe(168)
  })

  it('12x36 e jovem aprendiz nunca avisam', () => {
    expect(avisoCargaSemanal({ ...base, tipo_escala: '12x36' })).toBeNull()
    expect(avisoCargaSemanal({ ...base, tipo_escala: 'jovem_aprendiz' })).toBeNull()
  })
})

describe('formatarCargaSemanal', () => {
  it('formata horas cheias e quebradas', () => {
    expect(formatarCargaSemanal(2400)).toBe('40h')
    expect(formatarCargaSemanal(2580)).toBe('43h')
    expect(formatarCargaSemanal(2670)).toBe('44h30')
  })
})
