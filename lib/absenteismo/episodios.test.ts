// lib/absenteismo/episodios.test.ts
import { describe, it, expect } from 'vitest'
import { agruparAtestadosContiguos } from './episodios'

const a = (id: string, data_inicio: string, data_fim: string) => ({ id, data_inicio, data_fim })
const ids = (grupos: { id: string }[][]) => grupos.map(g => g.map(x => x.id))

describe('agruparAtestadosContiguos', () => {
  it('atestados separados por lacuna viram episódios diferentes', () => {
    expect(ids(agruparAtestadosContiguos([a('1', '2026-11-03', '2026-11-04'), a('2', '2026-11-10', '2026-11-11')]))).toEqual([['1'], ['2']])
  })
  it('o seguinte começa no dia seguinte: mesmo episódio', () => {
    expect(ids(agruparAtestadosContiguos([a('1', '2026-11-03', '2026-11-04'), a('2', '2026-11-05', '2026-11-06')]))).toEqual([['1', '2']])
  })
  it('passagem de bastão (mesmo dia): mesmo episódio', () => {
    expect(ids(agruparAtestadosContiguos([a('1', '2026-09-02', '2026-09-04'), a('2', '2026-09-04', '2026-09-13')]))).toEqual([['1', '2']])
  })
  it('atestado dentro de outro: mesmo episódio', () => {
    expect(ids(agruparAtestadosContiguos([a('1', '2026-11-01', '2026-11-20'), a('2', '2026-11-05', '2026-11-06')]))).toEqual([['1', '2']])
  })
  it('ordena entradas fora de ordem', () => {
    expect(ids(agruparAtestadosContiguos([a('2', '2026-11-05', '2026-11-06'), a('1', '2026-11-03', '2026-11-04')]))).toEqual([['1', '2']])
  })
  it('lista vazia', () => {
    expect(agruparAtestadosContiguos([])).toEqual([])
  })
})
