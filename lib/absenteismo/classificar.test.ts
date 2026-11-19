// lib/absenteismo/classificar.test.ts
import { describe, it, expect } from 'vitest'
import { classificarFalta, classificarAfastamento, LIMITE_DIAS_ATESTADO_EMPRESA } from './classificar'

describe('classificarFalta', () => {
  it('mapeia os tipos reais do banco', () => {
    expect(classificarFalta('sem_justificativa')).toBe('falta_injustificada')
    expect(classificarFalta('falta_injustificada')).toBe('falta_injustificada')
    expect(classificarFalta('sem_atestado')).toBe('falta_injustificada')
    expect(classificarFalta('justificada')).toBe('falta_justificada')
    expect(classificarFalta('falta_justificada')).toBe('falta_justificada')
    expect(classificarFalta('declaracao')).toBe('falta_justificada')
    expect(classificarFalta('com_atestado')).toBe('falta_justificada')
    expect(classificarFalta('atraso')).toBe('outras')
    expect(classificarFalta('suspensao')).toBe('suspensao')
  })
  it('tipo desconhecido cai em outras', () => {
    expect(classificarFalta('qualquer_coisa')).toBe('outras')
  })
})

describe('classificarAfastamento', () => {
  it('INSS (doença e acidente)', () => {
    expect(classificarAfastamento('INSS - Doença')).toBe('afastamento_inss')
    expect(classificarAfastamento('INSS - Acidente de Trabalho')).toBe('afastamento_inss')
  })
  it('licenças legais, com ou sem acento e caixa', () => {
    expect(classificarAfastamento('Licença Maternidade')).toBe('licenca_legal')
    expect(classificarAfastamento('Licença Paternidade')).toBe('licenca_legal')
    expect(classificarAfastamento('licenca maternidade')).toBe('licenca_legal')
  })
  it('o resto, inclusive nulo e texto solto, é outros', () => {
    expect(classificarAfastamento('Outros')).toBe('afastamento_outros')
    expect(classificarAfastamento('NA')).toBe('afastamento_outros')
    expect(classificarAfastamento(null)).toBe('afastamento_outros')
    expect(classificarAfastamento('Cirurgia odontologia ')).toBe('afastamento_outros')
  })
  it('"inss" só casa como palavra inteira', () => {
    expect(classificarAfastamento('Princípio da insssuficiência')).toBe('afastamento_outros')
  })
})

describe('constantes', () => {
  it('limite de dias pagos pela empresa é 15 (igual ao fechamento)', () => {
    expect(LIMITE_DIAS_ATESTADO_EMPRESA).toBe(15)
  })
})
