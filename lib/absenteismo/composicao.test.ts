// lib/absenteismo/composicao.test.ts
import { describe, it, expect } from 'vitest'
import { calcularPeriodo } from './calculo'
import { composicao, ORDEM_CLASSES, ROTULO_CLASSE } from './composicao'
import type { EntradaCalculo } from './tipos'

const entrada: EntradaCalculo = {
  inicio: '2026-11-01',
  fim: '2026-11-30',
  funcionarios: [{
    id: 'f1', nome: 'F', registro: null, admissao: '2020-01-01', desligamento: null, fora_do_quadro: false,
    regime: '5x2', posto_id: null, posto_nome: '—', secretaria: 'SME', supervisor_id: null, supervisor: '—',
  }],
  faltas: [
    { id: 'a', funcionario_id: 'f1', data_falta: '2026-11-03', data_fim: null, dias: 1, tipo: 'sem_justificativa', confirmada: true, observacao: null },
    { id: 'b', funcionario_id: 'f1', data_falta: '2026-11-04', data_fim: null, dias: 1, tipo: 'justificada', confirmada: true, observacao: null },
  ],
  atestados: [{ id: 'at', funcionario_id: 'f1', data_inicio: '2026-11-09', data_fim: '2026-11-10', cid_codigo: null, sem_cid: false, motivo: null }],
  afastamentos: [], ferias: [], suspensoes: [],
}

describe('composicao', () => {
  const fatias = composicao(calcularPeriodo(entrada))

  it('uma fatia por natureza, na ordem fixa', () => {
    expect(fatias.map(f => f.classe)).toEqual(ORDEM_CLASSES)
    expect(fatias.map(f => f.rotulo)).toEqual(ORDEM_CLASSES.map(c => ROTULO_CLASSE[c]))
  })
  it('jornadas, episódios e percentuais', () => {
    expect(fatias.map(f => f.jornadas)).toEqual([1, 1, 2, 0])
    expect(fatias.map(f => f.episodios)).toEqual([1, 1, 1, 0])
    expect(fatias.map(f => f.pct_jornadas)).toEqual([25, 25, 50, 0])
  })
  it('sem ausências: tudo zero, sem NaN', () => {
    const vazio = composicao(calcularPeriodo({ ...entrada, faltas: [], atestados: [] }))
    expect(vazio.map(f => f.pct_jornadas)).toEqual([0, 0, 0, 0])
  })
})
