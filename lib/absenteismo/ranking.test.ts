// lib/absenteismo/ranking.test.ts
import { describe, it, expect } from 'vitest'
import { rankingPor } from './ranking'
import type { EntradaCalculo, FuncionarioCalc } from './tipos'

const F = (id: string, secretaria: string, over: Partial<FuncionarioCalc> = {}): FuncionarioCalc => ({
  id, nome: id, registro: null, admissao: '2020-01-01', desligamento: null, fora_do_quadro: false,
  regime: '5x2', posto_id: `p-${id}`, posto_nome: `Posto ${id}`, secretaria, supervisor_id: null, supervisor: '—', ...over,
})

const entrada: EntradaCalculo = {
  inicio: '2026-11-01',
  fim: '2026-11-30',
  funcionarios: [F('a', 'SME'), F('b', 'SME'), F('c', 'SMEL'), F('d', 'SMS', { fora_do_quadro: true })],
  faltas: [{ id: 'x', funcionario_id: 'a', data_falta: '2026-11-03', data_fim: null, dias: 1, tipo: 'sem_justificativa', confirmada: true, observacao: null }],
  atestados: [], afastamentos: [], ferias: [], suspensoes: [],
}

describe('rankingPor', () => {
  const linhas = rankingPor('secretaria', entrada)

  it('ordena pela taxa, da maior para a menor', () => {
    expect(linhas.map(l => l.valor)).toEqual(['SME', 'SMEL'])
  })
  it('SME: quadro 2, 1 jornada perdida em 38 programadas', () => {
    expect(linhas[0]).toMatchObject({ valor: 'SME', quadro_medio: 2, jornadas_perdidas: 1, episodios: 1 })
    expect(linhas[0].taxa).toBeCloseTo(100 / 38, 6)
  })
  it('grupo sem ninguém no quadro (fora_do_quadro) não aparece', () => {
    expect(linhas.find(l => l.valor === 'SMS')).toBeUndefined()
  })
  it('agrupa por posto', () => {
    const porPosto = rankingPor('posto_nome', entrada)
    expect(porPosto[0]).toMatchObject({ valor: 'Posto a', jornadas_perdidas: 1 })
    expect(porPosto).toHaveLength(3)
  })
  it('funcionário sem secretaria ("—") não gera linha no ranking', () => {
    const comVazio: EntradaCalculo = { ...entrada, funcionarios: [...entrada.funcionarios, F('e', '—')] }
    const l = rankingPor('secretaria', comVazio)
    expect(l.find(x => x.valor === '—')).toBeUndefined()
    expect(l.map(x => x.valor)).toEqual(['SME', 'SMEL'])
  })
})
