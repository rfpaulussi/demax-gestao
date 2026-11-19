// lib/absenteismo/filtros.test.ts
import { describe, it, expect } from 'vitest'
import { filtrarFuncionarios } from './filtros'
import type { FuncionarioCalc } from './tipos'

const F = (over: Partial<FuncionarioCalc>): FuncionarioCalc => ({
  id: 'x', nome: 'N', registro: null, admissao: null, desligamento: null, fora_do_quadro: false,
  regime: '5x2', posto_id: 'p1', posto_nome: 'P1', secretaria: 'SME', supervisor_id: 's1', supervisor: 'Sup 1', ...over,
})
const lista = [
  F({ id: 'a' }),
  F({ id: 'b', secretaria: 'SMEL', posto_id: 'p2', supervisor_id: 's2' }),
  F({ id: 'c', secretaria: 'SME', posto_id: 'p3', supervisor_id: 's1' }),
]
const ids = (l: FuncionarioCalc[]) => l.map(f => f.id)

describe('filtrarFuncionarios', () => {
  it('sem filtros devolve todos', () => {
    expect(ids(filtrarFuncionarios(lista, {}))).toEqual(['a', 'b', 'c'])
  })
  it('por secretaria', () => {
    expect(ids(filtrarFuncionarios(lista, { secretaria: 'SME' }))).toEqual(['a', 'c'])
  })
  it('por posto', () => {
    expect(ids(filtrarFuncionarios(lista, { posto_id: 'p2' }))).toEqual(['b'])
  })
  it('por supervisor', () => {
    expect(ids(filtrarFuncionarios(lista, { supervisor_id: 's1' }))).toEqual(['a', 'c'])
  })
  it('filtros combinam (E)', () => {
    expect(ids(filtrarFuncionarios(lista, { secretaria: 'SME', posto_id: 'p3' }))).toEqual(['c'])
  })
  it('valor nulo ou vazio é "todos"', () => {
    expect(ids(filtrarFuncionarios(lista, { secretaria: null, posto_id: '' }))).toEqual(['a', 'b', 'c'])
  })
})
