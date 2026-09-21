import { describe, it, expect } from 'vitest'
import { construirMovimentos, resumoCalculo, saldoMin, agruparPorJornada } from './movimentos'
import { func, T_5X2_540 } from './__fixtures__'
import type { CamposAcordo } from './tipos'

const f1 = func('a')
const soma = (movs: { minutos: number }[]) => saldoMin(movs)

describe('construirMovimentos', () => {
  it('T1: evento trabalhado, quitação por redução', () => {
    const c: CamposAcordo = {
      template: 'T1', dataEvento: '2026-06-27', nomeEvento: 'Festa Junina',
      minutosOrigem: 120, datasAjuste: ['2026-06-30', '2026-07-01'],
    }
    const m = construirMovimentos(c, [f1])
    expect(m.map(x => [x.data, x.minutos, x.papel])).toEqual([
      ['2026-06-27', 120, 'origem'], ['2026-06-30', -60, 'quitacao'], ['2026-07-01', -60, 'quitacao'],
    ])
    expect(soma(m)).toBe(0)
  })

  it('T2: dispensa parcial, quitação por acréscimo', () => {
    const c: CamposAcordo = {
      template: 'T2', dataEvento: '2026-06-05', nomeEvento: 'Emenda',
      horaNormal: '15:00', horaDispensa: '12:00', datasAjuste: ['2026-06-08', '2026-06-09', '2026-06-10'],
    }
    const m = construirMovimentos(c, [f1])
    expect(m[0]).toMatchObject({ data: '2026-06-05', minutos: -180, papel: 'origem' })
    expect(m.slice(1).every(x => x.minutos === 60 && x.papel === 'quitacao')).toBe(true)
    expect(soma(m)).toBe(0)
  })

  it('T3: dia inteiro usa a jornada real do dia (sexta = 528)', () => {
    const c: CamposAcordo = {
      template: 'T3', dataFolga: '2026-06-05', motivo: 'ponto facultativo',
      datasAjuste: ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11'],
    }
    const m = construirMovimentos(c, [f1])
    expect(m[0]).toMatchObject({ data: '2026-06-05', minutos: -528, papel: 'origem' })
    expect(m.slice(1).map(x => x.minutos)).toEqual([132, 132, 132, 132])
    expect(soma(m)).toBe(0)
  })

  it('T4: acréscimos antes (origem) e folga depois (quitação)', () => {
    const c: CamposAcordo = {
      template: 'T4', dataFolga: '2026-06-12', motivo: 'ponto facultativo', prazoLimite: '2026-11-30',
      datasAjuste: ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11'],
    }
    const m = construirMovimentos(c, [f1])
    expect(m.filter(x => x.papel === 'origem').map(x => x.minutos)).toEqual([132, 132, 132, 132])
    expect(m.find(x => x.papel === 'quitacao')).toMatchObject({ data: '2026-06-12', minutos: -528 })
    expect(soma(m)).toBe(0)
  })

  it('T5: dia de descanso trabalhado, folga do mesmo tamanho', () => {
    const c: CamposAcordo = {
      template: 'T5', dataEvento: '2026-06-27', nomeEvento: 'Mutirão',
      minutosOrigem: 240, dataFolga: '2026-06-29', datasAjuste: [],
    }
    const m = construirMovimentos(c, [f1])
    expect(m.map(x => x.minutos)).toEqual([240, -240])
    expect(soma(m)).toBe(0)
  })

  it('gera movimentos por funcionário', () => {
    const c: CamposAcordo = { template: 'T5', dataEvento: '2026-06-27', nomeEvento: 'X', minutosOrigem: 60, dataFolga: '2026-06-29', datasAjuste: [] }
    expect(construirMovimentos(c, [func('a'), func('b')])).toHaveLength(4)
  })
})

describe('resumoCalculo e agrupamento', () => {
  const c: CamposAcordo = {
    template: 'T3', dataFolga: '2026-06-08', motivo: 'x', datasAjuste: ['2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12'],
  }

  it('resume total e minutos por dia', () => {
    expect(resumoCalculo(c, [f1])).toEqual({ horasTotalMin: 528, minutosPorDia: 132, jornadaFolgaMin: 528 })
  })

  it('separa funcionários com jornadas diferentes no dia da folga', () => {
    const grupos = agruparPorJornada(c, [func('a'), func('b', T_5X2_540), func('c')])
    expect(grupos.map(g => g.map(f => f.id))).toEqual([['a', 'c'], ['b']])
  })

  it('templates sem dia de folga ficam em um grupo só', () => {
    const t1: CamposAcordo = { template: 'T1', dataEvento: '2026-06-13', nomeEvento: 'x', minutosOrigem: 60, datasAjuste: ['2026-06-15'] }
    expect(agruparPorJornada(t1, [func('a'), func('b', T_5X2_540)])).toHaveLength(1)
  })
})
