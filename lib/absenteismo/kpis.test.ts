// lib/absenteismo/kpis.test.ts
import { describe, it, expect } from 'vitest'
import { calcularPeriodo } from './calculo'
import { calcularKpis, variacaoPercentual, variacaoPontos } from './kpis'
import type { EntradaCalculo, FuncionarioCalc } from './tipos'

const F = (id: string): FuncionarioCalc => ({
  id, nome: id, registro: null, admissao: '2020-01-01', desligamento: null, fora_do_quadro: false,
  regime: '5x2', posto_id: null, posto_nome: '—', secretaria: 'SME', supervisor_id: null, supervisor: '—',
})
const entrada = (over: Partial<EntradaCalculo>): EntradaCalculo => ({
  inicio: '2026-11-01', fim: '2026-11-30', funcionarios: [F('f1')],
  faltas: [], atestados: [], afastamentos: [], ferias: [], suspensoes: [], ...over,
})
const falta = (id: string, funcionario_id: string, data_falta: string) => ({
  id, funcionario_id, data_falta, data_fim: null, dias: 1, tipo: 'sem_justificativa', confirmada: true, observacao: null,
})

describe('calcularKpis', () => {
  it('1 falta, 1 funcionário: 1/19 de taxa, IF 100, IG 100, duração 1', () => {
    const k = calcularKpis(calcularPeriodo(entrada({ faltas: [falta('a', 'f1', '2026-11-03')] })))
    expect(k.taxa).toBeCloseTo((1 / 19) * 100, 6)
    expect(k.indice_frequencia).toBeCloseTo(100, 6)
    expect(k.indice_gravidade).toBeCloseTo(100, 6)
    expect(k.duracao_media).toBe(1)
    expect(k.funcionarios_afetados).toBe(1)
    expect(k.pct_afetados).toBeCloseTo(100, 6)
    expect(k.taxa_reincidencia).toBe(0)
  })
  it('2 funcionários, 1 afetado com 2 episódios', () => {
    const k = calcularPeriodo(entrada({
      funcionarios: [F('f1'), F('f2')],
      faltas: [falta('a', 'f1', '2026-11-03'), falta('b', 'f1', '2026-11-05')],
    }))
    const r = calcularKpis(k)
    expect(r.episodios).toBe(2)
    expect(r.indice_frequencia).toBeCloseTo(100, 6) // 2 episódios / 2 quadro * 100
    expect(r.pct_afetados).toBeCloseTo(50, 6)
    expect(r.taxa_reincidencia).toBeCloseTo(100, 6)
    expect(r.duracao_media).toBe(1)
    expect(r.taxa).toBeCloseTo((2 / 38) * 100, 6)
  })
  it('sem dados: tudo zero, sem NaN', () => {
    const r = calcularKpis(calcularPeriodo(entrada({ funcionarios: [] })))
    expect(r).toMatchObject({ taxa: 0, indice_frequencia: 0, indice_gravidade: 0, duracao_media: 0, pct_afetados: 0, taxa_reincidencia: 0 })
  })
})

describe('variações', () => {
  it('percentual relativo; null quando o anterior é zero', () => {
    expect(variacaoPercentual(90, 100)).toBeCloseTo(-10, 6)
    expect(variacaoPercentual(5, 0)).toBeNull()
  })
  it('pontos percentuais para taxas', () => {
    expect(variacaoPontos(2.9, 3.3)).toBeCloseTo(-0.4, 6)
  })
})
