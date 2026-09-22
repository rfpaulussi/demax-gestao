import { describe, it, expect } from 'vitest'
import { simularPedido } from './aplicar'
import type { ResultadoIA } from './normalizar'
import { func, T_5X2_540 } from '../__fixtures__'

const base: ResultadoIA = { template: null, form: {}, postoId: 'p', funcionarioIds: [], quantidadeDias: null, perguntas: [], avisos: [] }
const hoje = '2026-06-01'

describe('simularPedido', () => {
  it('sem situação não simula', () => {
    expect(simularPedido(base, [func('a')], new Map(), hoje)).toBeNull()
  })

  it('T3 com a quantidade de dias do pedido: escolhe os dias e passa na validação', () => {
    const r: ResultadoIA = { ...base, template: 'T3', form: { dataFolga: '2026-06-05', motivo: 'ponto facultativo municipal' }, quantidadeDias: 8 }
    const s = simularPedido(r, [func('a')], new Map(), hoje)!
    expect(s.form.datasAjuste).toHaveLength(8)
    expect(s.minutosPorDia).toBe(66)
    expect(s.achados.filter(a => a.nivel === 'erro')).toEqual([])
  })

  it('sinaliza o limite de 10h por dia quando o pedido força poucos dias', () => {
    const r: ResultadoIA = { ...base, template: 'T3', form: { dataFolga: '2026-06-05', motivo: 'ponto facultativo municipal' }, quantidadeDias: 4 }
    const s = simularPedido(r, [func('a', T_5X2_540)], new Map(), hoje)!
    expect(s.achados.map(a => a.codigo)).toContain('LIMITE_JORNADA')
  })

  it('sem quantidade, usa a sugestão automática (menor número de dias que serve)', () => {
    const r: ResultadoIA = { ...base, template: 'T3', form: { dataFolga: '2026-06-05', motivo: 'ponto facultativo municipal' } }
    const s = simularPedido(r, [func('a')], new Map(), hoje)!
    expect(s.form.datasAjuste.length).toBeGreaterThan(0)
    expect(s.achados.filter(a => a.nivel === 'erro')).toEqual([])
  })
})
