// lib/absenteismo/calor.test.ts
import { describe, it, expect } from 'vitest'
import { calcularPeriodo } from './calculo'
import { DIAS_SEMANA, mapaCalor } from './calor'
import type { EntradaCalculo } from './tipos'

const base: EntradaCalculo = {
  inicio: '2026-11-01',
  fim: '2026-11-30',
  funcionarios: [{
    id: 'f1', nome: 'F', registro: null, admissao: '2020-01-01', desligamento: null, fora_do_quadro: false,
    regime: '5x2', posto_id: null, posto_nome: '—', secretaria: 'SME', supervisor_id: null, supervisor: '—',
  }],
  faltas: [], atestados: [], afastamentos: [], ferias: [], suspensoes: [],
}
const falta = (id: string, data: string, tipo = 'sem_justificativa') =>
  ({ id, funcionario_id: 'f1', data_falta: data, data_fim: null, dias: 1, tipo, confirmada: true, observacao: null })

describe('mapaCalor', () => {
  it('rótulos de segunda a domingo', () => {
    expect(DIAS_SEMANA).toEqual(['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'])
  })

  it('conta episódios no dia da semana do início (segunda = 0, domingo = 6)', () => {
    const r = calcularPeriodo({
      ...base,
      faltas: [falta('a', '2026-11-03'), falta('b', '2026-11-09'), falta('c', '2026-11-10')], // ter, seg, ter
      atestados: [{ id: 'at', funcionario_id: 'f1', data_inicio: '2026-11-07', data_fim: '2026-11-08', cid_codigo: null, sem_cid: false, motivo: null }], // sáb
    })
    const linhas = mapaCalor(r)
    const inj = linhas.find(l => l.classe === 'falta_injustificada')!
    const ate = linhas.find(l => l.classe === 'atestado')!
    expect(inj.porDia).toEqual([1, 2, 0, 0, 0, 0, 0])
    expect(inj.total).toBe(3)
    expect(ate.porDia).toEqual([0, 0, 0, 0, 0, 1, 0])
  })

  it('episódio que começou antes do período não entra', () => {
    const r = calcularPeriodo({
      ...base,
      inicio: '2026-11-13',
      faltas: [{ ...falta('a', '2026-11-12'), data_fim: '2026-11-16', dias: 5 }],
    })
    expect(r.episodios).toHaveLength(1)
    expect(mapaCalor(r).every(l => l.total === 0)).toBe(true)
  })

  it('devolve as 4 naturezas mesmo sem dados', () => {
    expect(mapaCalor(calcularPeriodo(base))).toHaveLength(4)
  })
})
