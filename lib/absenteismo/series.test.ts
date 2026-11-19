// lib/absenteismo/series.test.ts
import { describe, it, expect } from 'vitest'
import { mesesAte, periodoEfetivo, calcularSerieMensal } from './series'
import type { DadosAbsenteismo } from './tipos'

describe('mesesAte', () => {
  it('devolve n meses em ordem crescente terminando no informado', () => {
    expect(mesesAte(2026, 11, 3)).toEqual([{ ano: 2026, mes: 9 }, { ano: 2026, mes: 10 }, { ano: 2026, mes: 11 }])
  })
  it('atravessa a virada de ano', () => {
    expect(mesesAte(2026, 2, 3)).toEqual([{ ano: 2025, mes: 12 }, { ano: 2026, mes: 1 }, { ano: 2026, mes: 2 }])
  })
})

describe('periodoEfetivo', () => {
  const desde = '2026-06-18'
  const hoje = '2026-11-19'
  it('mês cheio no meio do histórico não é parcial', () => {
    expect(periodoEfetivo('2026-08-01', '2026-08-31', desde, hoje)).toEqual({ inicio: '2026-08-01', fim: '2026-08-31', parcial: false })
  })
  it('mês que contém dadosDesde começa nele e é parcial', () => {
    expect(periodoEfetivo('2026-06-01', '2026-06-30', desde, hoje)).toEqual({ inicio: '2026-06-18', fim: '2026-06-30', parcial: true })
  })
  it('mês corrente vai só até hoje e é parcial', () => {
    expect(periodoEfetivo('2026-11-01', '2026-11-30', desde, hoje)).toEqual({ inicio: '2026-11-01', fim: '2026-11-19', parcial: true })
  })
  it('mês inteiro antes de dadosDesde ou depois de hoje: null', () => {
    expect(periodoEfetivo('2026-05-01', '2026-05-31', desde, hoje)).toBeNull()
    expect(periodoEfetivo('2026-12-01', '2026-12-31', desde, hoje)).toBeNull()
  })
})

describe('calcularSerieMensal', () => {
  const dados: DadosAbsenteismo = {
    funcionarios: [{
      id: 'f1', nome: 'F', registro: null, admissao: '2020-01-01', desligamento: null, fora_do_quadro: false,
      regime: '5x2', posto_id: null, posto_nome: '—', secretaria: 'SME', supervisor_id: null, supervisor: '—',
    }],
    faltas: [{ id: 'a', funcionario_id: 'f1', data_falta: '2026-11-03', data_fim: null, dias: 1, tipo: 'sem_justificativa', confirmada: true, observacao: null }],
    atestados: [], afastamentos: [], ferias: [], suspensoes: [],
  }
  const serie = calcularSerieMensal(dados, mesesAte(2026, 11, 3), '2026-10-10', '2026-11-19')

  it('mês sem dados vem com taxa null', () => {
    expect(serie[0]).toMatchObject({ mes: '2026-09', taxa: null, parcial: false, episodios: 0 })
  })
  it('mês que começa no meio do histórico é parcial e usa só o recorte', () => {
    expect(serie[1]).toMatchObject({ mes: '2026-10', taxa: 0, parcial: true })
  })
  it('mês corrente: base só até hoje (13 jornadas até 19/11), 1 falta', () => {
    expect(serie[2].mes).toBe('2026-11')
    expect(serie[2].parcial).toBe(true)
    expect(serie[2].taxa).toBeCloseTo((1 / 13) * 100, 6)
    expect(serie[2].episodios).toBe(1)
    expect(serie[2].jornadas_perdidas).toBe(1)
  })
  it('recorte sem nenhuma jornada programada (fim de semana) vem com taxa null', () => {
    const s2 = calcularSerieMensal(dados, [{ ano: 2026, mes: 11 }], '2026-11-07', '2026-11-08')
    expect(s2[0]).toMatchObject({ mes: '2026-11', taxa: null, parcial: true })
  })
})
