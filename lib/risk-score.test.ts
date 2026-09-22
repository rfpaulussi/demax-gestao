import { describe, it, expect } from 'vitest'
import { calcularScoreRisco, dataCorteScoreRisco, JANELA_SCORE_RISCO_DIAS } from './risk-score'

describe('calcularScoreRisco', () => {
  it('devolve score 0 e nível ok sem nenhum evento', () => {
    const r = calcularScoreRisco({ faltas: [], advertencias: [], atestados: [], movimentacoes: [] })
    expect(r.score).toBe(0)
    expect(r.nivel).toBe('ok')
    expect(r.breakdown).toEqual([])
  })

  it('pontua falta sem justificativa com peso 3', () => {
    const r = calcularScoreRisco({
      faltas: [{ data_falta: '2026-09-01', tipo: 'sem_justificativa' }],
      advertencias: [], atestados: [], movimentacoes: [],
    })
    expect(r.score).toBe(3)
    expect(r.nivel).toBe('ok')
  })

  it('pontua falta justificada com peso 0.5', () => {
    const r = calcularScoreRisco({
      faltas: [{ data_falta: '2026-09-01', tipo: 'com_atestado' }],
      advertencias: [], atestados: [], movimentacoes: [],
    })
    expect(r.score).toBe(0.5)
  })

  it('pontua advertência por grau (verbal=3, escrita=5, suspensao=8)', () => {
    const r = calcularScoreRisco({
      faltas: [], atestados: [], movimentacoes: [],
      advertencias: [
        { data_ocorrencia: '2026-09-01', grau: 'verbal' },
        { data_ocorrencia: '2026-09-05', grau: 'escrita' },
        { data_ocorrencia: '2026-09-10', grau: 'suspensao' },
      ],
    })
    expect(r.score).toBe(16)
  })

  it('trata grau nulo/desconhecido como leve (peso 3)', () => {
    const r = calcularScoreRisco({
      faltas: [], atestados: [], movimentacoes: [],
      advertencias: [{ data_ocorrencia: '2026-09-01', grau: null }],
    })
    expect(r.score).toBe(3)
  })

  it('pontua atestado por dia de afastamento (0.3/dia)', () => {
    const r = calcularScoreRisco({
      faltas: [], advertencias: [], movimentacoes: [],
      atestados: [{ data_inicio: '2026-09-01', data_fim: '2026-09-10' }], // 10 dias
    })
    expect(r.score).toBe(3)
  })

  it('atestado de 1 dia (sem data_fim) conta como 1 dia', () => {
    const r = calcularScoreRisco({
      faltas: [], advertencias: [], movimentacoes: [],
      atestados: [{ data_inicio: '2026-09-01', data_fim: null }],
    })
    expect(r.score).toBe(0.3)
  })

  it('só pontua movimentação relevante além da 2ª no período', () => {
    const mov = (tipo: string, i: number) => ({ tipo, created_at: `2026-09-0${i}T00:00:00Z` })
    const r = calcularScoreRisco({
      faltas: [], advertencias: [], atestados: [],
      movimentacoes: [
        mov('transferencia', 1),
        mov('mudanca_funcao', 2),
        mov('mudanca_horario', 3),
        mov('mudanca_horario', 4),
      ],
    })
    // 4 movimentações relevantes, limite 2 sem ponto → 2 extras × 1pt
    expect(r.score).toBe(2)
  })

  it('ignora movimentação de tipo não relevante para o score', () => {
    const r = calcularScoreRisco({
      faltas: [], advertencias: [], atestados: [],
      movimentacoes: [
        { tipo: 'outro_tipo_qualquer', created_at: '2026-09-01T00:00:00Z' },
        { tipo: 'outro_tipo_qualquer', created_at: '2026-09-02T00:00:00Z' },
        { tipo: 'outro_tipo_qualquer', created_at: '2026-09-03T00:00:00Z' },
      ],
    })
    expect(r.score).toBe(0)
  })

  it('classifica nível por faixa: ok < 5, atencao 5-9, critico >= 10', () => {
    const faltasN = (n: number) => Array.from({ length: n }, (_, i) => ({ data_falta: `2026-09-${String(i + 1).padStart(2, '0')}`, tipo: 'sem_justificativa' }))
    expect(calcularScoreRisco({ faltas: faltasN(1), advertencias: [], atestados: [], movimentacoes: [] }).nivel).toBe('ok')      // 3pt
    expect(calcularScoreRisco({ faltas: faltasN(2), advertencias: [], atestados: [], movimentacoes: [] }).nivel).toBe('atencao') // 6pt
    expect(calcularScoreRisco({ faltas: faltasN(4), advertencias: [], atestados: [], movimentacoes: [] }).nivel).toBe('critico') // 12pt
  })

  it('score não tem teto — soma aberta', () => {
    const faltasN = (n: number) => Array.from({ length: n }, (_, i) => ({ data_falta: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, tipo: 'sem_justificativa' }))
    const r = calcularScoreRisco({ faltas: faltasN(20), advertencias: [], atestados: [], movimentacoes: [] })
    expect(r.score).toBe(60)
    expect(r.nivel).toBe('critico')
  })

  it('breakdown descreve cada categoria pontuada', () => {
    const r = calcularScoreRisco({
      faltas: [{ data_falta: '2026-09-01', tipo: 'sem_justificativa' }],
      advertencias: [{ data_ocorrencia: '2026-09-01', grau: 'verbal' }],
      atestados: [], movimentacoes: [],
    })
    expect(r.breakdown).toEqual([
      '1 falta(s) sem justificativa (3pt)',
      '1 advertência(s) grau verbal (3pt)',
    ])
  })
})

describe('dataCorteScoreRisco', () => {
  it('devolve a data 90 dias antes da referência, formato YYYY-MM-DD', () => {
    expect(dataCorteScoreRisco(new Date('2026-09-22T12:00:00Z'))).toBe('2026-06-24')
  })

  it('usa JANELA_SCORE_RISCO_DIAS = 90', () => {
    expect(JANELA_SCORE_RISCO_DIAS).toBe(90)
  })
})
