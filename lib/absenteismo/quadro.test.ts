// lib/absenteismo/quadro.test.ts
import { describe, it, expect } from 'vitest'
import { janelaDoFuncionario, quadroNoDia, quadroMedio, type FuncQuadro } from './quadro'

const f = (over: Partial<FuncQuadro> = {}): FuncQuadro => ({
  id: 'f1', admissao: '2020-01-01', desligamento: null, fora_do_quadro: false, ...over,
})

describe('janelaDoFuncionario', () => {
  it('funcionário antigo cobre o período todo', () => {
    expect(janelaDoFuncionario(f(), '2026-11-01', '2026-11-30')).toEqual({ inicio: '2026-11-01', fim: '2026-11-30' })
  })
  it('admissão no meio do período corta o início', () => {
    expect(janelaDoFuncionario(f({ admissao: '2026-11-16' }), '2026-11-01', '2026-11-30')).toEqual({ inicio: '2026-11-16', fim: '2026-11-30' })
  })
  it('desligamento: o último dia no quadro é o anterior', () => {
    expect(janelaDoFuncionario(f({ desligamento: '2026-11-10' }), '2026-11-01', '2026-11-30')).toEqual({ inicio: '2026-11-01', fim: '2026-11-09' })
  })
  it('desligado antes do período ou admitido depois: fora', () => {
    expect(janelaDoFuncionario(f({ desligamento: '2026-10-31' }), '2026-11-01', '2026-11-30')).toBeNull()
    expect(janelaDoFuncionario(f({ admissao: '2026-12-01' }), '2026-11-01', '2026-11-30')).toBeNull()
  })
  it('fora_do_quadro sempre exclui', () => {
    expect(janelaDoFuncionario(f({ fora_do_quadro: true }), '2026-11-01', '2026-11-30')).toBeNull()
  })
  it('admissão nula vale desde sempre', () => {
    expect(janelaDoFuncionario(f({ admissao: null }), '2026-11-01', '2026-11-30')).toEqual({ inicio: '2026-11-01', fim: '2026-11-30' })
  })
})

describe('quadroNoDia', () => {
  it('conta só quem está no quadro naquele dia', () => {
    const funcs = [f({ id: 'a' }), f({ id: 'b', admissao: '2026-11-16' }), f({ id: 'c', desligamento: '2026-11-10' })]
    expect(quadroNoDia(funcs, '2026-11-09')).toBe(2) // a, c
    expect(quadroNoDia(funcs, '2026-11-10')).toBe(1) // só a
    expect(quadroNoDia(funcs, '2026-11-16')).toBe(2) // a, b
  })
})

describe('quadroMedio', () => {
  it('um funcionário o mês todo vale 1', () => {
    expect(quadroMedio([f()], '2026-11-01', '2026-11-30')).toBe(1)
  })
  it('admitido dia 16 vale 15/30', () => {
    expect(quadroMedio([f({ admissao: '2026-11-16' })], '2026-11-01', '2026-11-30')).toBe(0.5)
  })
  it('desligado dia 10 vale 9/30', () => {
    expect(quadroMedio([f({ desligamento: '2026-11-10' })], '2026-11-01', '2026-11-30')).toBeCloseTo(0.3, 10)
  })
  it('lista vazia vale 0', () => {
    expect(quadroMedio([], '2026-11-01', '2026-11-30')).toBe(0)
  })
})
