import { describe, it, expect } from 'vitest'
import {
  sugerirQuantidadeDias, sugerirQuantidadeDiasComum, proximosDiasUteis, diasUteisAnteriores, sugerirDiasAjuste, motivoSemSugestao,
} from './dias'
import { func, T_5X2_540 } from './__fixtures__'
import type { CamposAcordo } from './tipos'

describe('sugerirQuantidadeDias', () => {
  it('escolhe o menor número de dias que divide exato e respeita o máximo por dia', () => {
    expect(sugerirQuantidadeDias(528, 72)).toBe(8)   // 66 min/dia
    expect(sugerirQuantidadeDias(120, 60)).toBe(2)   // 60 min/dia
  })

  it('devolve null quando não existe divisão possível', () => {
    expect(sugerirQuantidadeDias(100, 3)).toBeNull()
  })
})

describe('proximosDiasUteis', () => {
  const f1 = func('a')

  it('pula fim de semana', () => {
    expect(proximosDiasUteis('2026-06-05', 3, [f1], new Map())).toEqual(['2026-06-08', '2026-06-09', '2026-06-10'])
  })

  it('pula feriados e pontos facultativos do calendário', () => {
    const feriados = new Map([['2026-06-09', { nome: 'Ponto facultativo', tipo: 'facultativo' }]])
    expect(proximosDiasUteis('2026-06-05', 3, [f1], feriados)).toEqual(['2026-06-08', '2026-06-10', '2026-06-11'])
  })
})

describe('sugerirQuantidadeDiasComum', () => {
  it('acha o menor n que serve para todos os totais', () => {
    expect(sugerirQuantidadeDiasComum([528], 72)).toBe(8)
    expect(sugerirQuantidadeDiasComum([528, 540], 120)).toBe(6)   // 88 e 90 min/dia
    expect(sugerirQuantidadeDiasComum([528, 540], 72)).toBe(12)   // 44 e 45 min/dia
  })

  it('devolve null sem divisão comum, com total <= 0 ou sem totais', () => {
    expect(sugerirQuantidadeDiasComum([528, 540], 10)).toBeNull()
    expect(sugerirQuantidadeDiasComum([528, 0], 120)).toBeNull()
    expect(sugerirQuantidadeDiasComum([], 120)).toBeNull()
  })
})

describe('diasUteisAnteriores', () => {
  it('devolve os dias úteis antes da data em ordem crescente, pulando fim de semana e calendário', () => {
    expect(diasUteisAnteriores('2026-06-12', 3, [func('a')], new Map())).toEqual(['2026-06-09', '2026-06-10', '2026-06-11'])
    const feriados = new Map([['2026-06-10', { nome: 'Ponto facultativo', tipo: 'facultativo' }]])
    expect(diasUteisAnteriores('2026-06-09', 3, [func('a')], feriados)).toEqual(['2026-06-04', '2026-06-05', '2026-06-08'])
  })
})

describe('sugerirDiasAjuste', () => {
  const a = func('a')

  it('T3: folga na sexta, 528 min em 8 dias úteis seguintes', () => {
    const c: CamposAcordo = { template: 'T3', dataFolga: '2026-06-05', motivo: 'x', datasAjuste: [] }
    expect(sugerirDiasAjuste(c, [a], new Map())).toEqual([
      '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-15', '2026-06-16', '2026-06-17',
    ])
  })

  it('T1: sábado 08:00-10:00 (120 min) reduz em 2 dias de 60 min', () => {
    const c: CamposAcordo = { template: 'T1', dataEvento: '2026-06-13', nomeEvento: 'x', periodoInicio: '08:00', periodoFim: '10:00', datasAjuste: [] }
    expect(sugerirDiasAjuste(c, [a], new Map())).toEqual(['2026-06-15', '2026-06-16'])
  })

  it('T2: dispensa às 14:00 (180 min) compensa em 3 dias', () => {
    const c: CamposAcordo = { template: 'T2', dataEvento: '2026-06-05', nomeEvento: 'x', horaDispensa: '14:00', datasAjuste: [] }
    expect(sugerirDiasAjuste(c, [a], new Map())).toEqual(['2026-06-08', '2026-06-09', '2026-06-10'])
  })

  it('T4: acréscimos nos dias úteis anteriores à folga', () => {
    const c: CamposAcordo = { template: 'T4', dataFolga: '2026-06-12', motivo: 'x', prazoLimite: '2026-11-30', datasAjuste: [] }
    expect(sugerirDiasAjuste(c, [a], new Map())).toEqual([
      '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11',
    ])
  })

  it('T4 respeita hoje: sem dias úteis suficientes até a folga não sugere nada', () => {
    const c: CamposAcordo = { template: 'T4', dataFolga: '2026-09-25', motivo: 'x', prazoLimite: '2026-11-30', datasAjuste: [] }
    expect(sugerirDiasAjuste(c, [a], new Map(), '2026-09-21')).toEqual([])
    const c2: CamposAcordo = { template: 'T4', dataFolga: '2026-06-12', motivo: 'x', prazoLimite: '2026-11-30', datasAjuste: [] }
    expect(sugerirDiasAjuste(c2, [a], new Map(), '2026-05-01')).toEqual([
      '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11',
    ])
  })

  it('T5 e dados insuficientes não sugerem nada', () => {
    const t5: CamposAcordo = { template: 'T5', dataEvento: '2026-06-13', nomeEvento: 'x', minutosOrigem: 240, dataFolga: '2026-06-15', datasAjuste: [] }
    expect(sugerirDiasAjuste(t5, [a], new Map())).toEqual([])
    expect(sugerirDiasAjuste({ template: 'T3', datasAjuste: [] }, [a], new Map())).toEqual([])
    expect(sugerirDiasAjuste({ template: 'T3', dataFolga: '2026-06-05', datasAjuste: [] }, [], new Map())).toEqual([])
    const t1: CamposAcordo = { template: 'T1', dataEvento: '2026-06-08', nomeEvento: 'x', periodoInicio: '08:00', periodoFim: '10:00', datasAjuste: [] }
    expect(sugerirDiasAjuste(t1, [a], new Map())).toEqual([]) // dentro do horário: total 0
  })

  it('dois grupos (528 e 540 min) usam a quantidade de dias comum', () => {
    const c: CamposAcordo = { template: 'T3', dataFolga: '2026-06-08', motivo: 'x', datasAjuste: [] }
    // jornada máx. 540 -> até 60 min/dia; n comum = 12 (44 e 45 min)
    expect(sugerirDiasAjuste(c, [a, func('b', T_5X2_540)], new Map())).toEqual([
      '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-15', '2026-06-16',
      '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-22', '2026-06-23', '2026-06-24',
    ])
  })
})

describe('motivoSemSugestao', () => {
  const f = func('a')
  it('T1 com horas demais: explica o limite de dias', () => {
    const c: CamposAcordo = { template: 'T1', dataEvento: '2026-09-18', nomeEvento: 'x', minutosOrigem: 480, datasAjuste: [] }
    const m = motivoSemSugestao({ ...c, datasEvento: ['2026-09-05', '2026-09-18'], minutosOrigem: 960 }, [f], new Map(), '2026-09-21')
    expect(m).toContain('passam de 10h')
    const t1: CamposAcordo = { template: 'T1', dataEvento: '2026-09-18', datasEvento: ['2026-09-05', '2026-09-18', '2026-09-19', '2026-09-20'], nomeEvento: 'x', minutosOrigem: 600, datasAjuste: [] }
    expect(motivoSemSugestao(t1, [f], new Map(), '2026-09-21')).toContain('mais de 31 dias')
  })

  it('devolve null quando há sugestão ou faltam dados', () => {
    const ok: CamposAcordo = { template: 'T1', dataEvento: '2026-09-18', nomeEvento: 'x', minutosOrigem: 240, datasAjuste: [] }
    expect(motivoSemSugestao(ok, [f], new Map(), '2026-09-21')).toBeNull()
    expect(motivoSemSugestao({ template: 'T1', datasAjuste: [] }, [f], new Map())).toBeNull()
  })
})
