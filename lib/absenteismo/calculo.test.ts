// lib/absenteismo/calculo.test.ts
import { describe, it, expect } from 'vitest'
import { calcularPeriodo } from './calculo'
import type { EntradaCalculo, FaltaIn, FuncionarioCalc } from './tipos'

const F = (over: Partial<FuncionarioCalc> = {}): FuncionarioCalc => ({
  id: 'f1', nome: 'Fulano', registro: '1', admissao: '2020-01-01', desligamento: null,
  fora_do_quadro: false, regime: '5x2', posto_id: 'p1', posto_nome: 'Posto 1', secretaria: 'SME',
  supervisor_id: null, supervisor: '—', ...over,
})
const base = (over: Partial<EntradaCalculo> = {}): EntradaCalculo => ({
  inicio: '2026-11-01', fim: '2026-11-30', funcionarios: [F()],
  faltas: [], atestados: [], afastamentos: [], ferias: [], suspensoes: [], ...over,
})
const falta = (over: Partial<FaltaIn> = {}): FaltaIn => ({
  id: 'fa1', funcionario_id: 'f1', data_falta: '2026-11-03', data_fim: null, dias: 1,
  tipo: 'sem_justificativa', confirmada: true, observacao: null, ...over,
})
const atestado = (over: Partial<{ id: string; data_inicio: string; data_fim: string }> = {}) => ({
  id: 'at1', funcionario_id: 'f1', data_inicio: '2026-11-03', data_fim: '2026-11-09',
  cid_codigo: null, sem_cid: false, motivo: null, ...over,
})
const afast = (over: Partial<{ id: string; data_inicio: string; data_fim_real: string | null; data_fim_prevista: string | null; motivo: string | null }> = {}) => ({
  id: 'af1', funcionario_id: 'f1', data_inicio: '2026-11-10', data_fim_prevista: null,
  data_fim_real: null, motivo: 'INSS - Doença', ...over,
})

describe('calcularPeriodo — base', () => {
  it('sem ausências: 19 jornadas programadas, 0 perdidas', () => {
    const r = calcularPeriodo(base())
    expect(r.jornadas_programadas).toBe(19)
    expect(r.jornadas_perdidas).toBe(0)
    expect(r.episodios).toEqual([])
    expect(r.quadro_medio).toBe(1)
    expect(r.dias_corridos).toBe(30)
  })
  it('sem funcionários: tudo zero', () => {
    const r = calcularPeriodo(base({ funcionarios: [] }))
    expect(r.jornadas_programadas).toBe(0)
    expect(r.quadro_medio).toBe(0)
  })
  it('eventos de funcionário que não está na lista são ignorados', () => {
    const r = calcularPeriodo(base({ faltas: [falta({ funcionario_id: 'outro' })] }))
    expect(r.jornadas_perdidas).toBe(0)
  })
})

describe('calcularPeriodo — faltas', () => {
  it('falta de 1 dia: 1 jornada, 1 episódio injustificado', () => {
    const r = calcularPeriodo(base({ faltas: [falta()] }))
    expect(r.jornadas_perdidas).toBe(1)
    expect(r.perdidas_por_classe.falta_injustificada).toBe(1)
    expect(r.episodios).toHaveLength(1)
    expect(r.episodios[0]).toMatchObject({ id: 'fa1', classe: 'falta_injustificada', jornadas: 1, confirmada: true })
    expect(r.funcionarios_afetados).toBe(1)
    expect(r.funcionarios_reincidentes).toBe(0)
  })
  it('falta que atravessa o fim de semana conta só os dias programados', () => {
    // 12/11 (qui) a 17/11 (ter): programados 12, 13, 16, 17
    const r = calcularPeriodo(base({ faltas: [falta({ data_falta: '2026-11-12', data_fim: '2026-11-17', dias: 6 })] }))
    expect(r.jornadas_perdidas).toBe(4)
    expect(r.episodios).toHaveLength(1)
    expect(r.episodios[0]).toMatchObject({ inicio: '2026-11-12', fim: '2026-11-17', jornadas: 4 })
  })
  it('falta é cortada no limite do período', () => {
    // 27/11 a 03/12 dentro de novembro: 27 e 30 (27 sex, 30 seg)
    const r = calcularPeriodo(base({ faltas: [falta({ data_falta: '2026-11-27', data_fim: '2026-12-03', dias: 7 })] }))
    expect(r.jornadas_perdidas).toBe(2)
  })
  it('sem data_fim usa data_falta + dias - 1', () => {
    const r = calcularPeriodo(base({ faltas: [falta({ data_falta: '2026-11-09', dias: 5 })] }))
    expect(r.jornadas_perdidas).toBe(5)
  })
  it('classes: justificada, declaração e atraso', () => {
    const r = calcularPeriodo(base({
      faltas: [
        falta({ id: 'a', data_falta: '2026-11-03', tipo: 'justificada' }),
        falta({ id: 'b', data_falta: '2026-11-04', tipo: 'declaracao' }),
        falta({ id: 'c', data_falta: '2026-11-05', tipo: 'atraso' }),
      ],
    }))
    expect(r.perdidas_por_classe.falta_justificada).toBe(2)
    expect(r.perdidas_por_classe.outras).toBe(1)
    expect(r.perdidas_por_classe.falta_injustificada).toBe(0)
  })
  it('falta pendente de confirmação carrega a marca', () => {
    const r = calcularPeriodo(base({ faltas: [falta({ confirmada: false })] }))
    expect(r.episodios[0].confirmada).toBe(false)
  })
  it('duas faltas em dias diferentes: 2 episódios, 1 afetado, 1 reincidente', () => {
    const r = calcularPeriodo(base({ faltas: [falta({ id: 'a' }), falta({ id: 'b', data_falta: '2026-11-05' })] }))
    expect(r.episodios).toHaveLength(2)
    expect(r.funcionarios_afetados).toBe(1)
    expect(r.funcionarios_reincidentes).toBe(1)
    expect(r.por_funcionario['f1']).toEqual({ programadas: 19, perdidas: 2, episodios: 2 })
  })
})

describe('calcularPeriodo — atestados', () => {
  it('atestado de 7 dias (3 a 9/11): 5 jornadas, 1 episódio', () => {
    const r = calcularPeriodo(base({ atestados: [atestado()] }))
    expect(r.jornadas_perdidas).toBe(5)
    expect(r.perdidas_por_classe.atestado).toBe(5)
    expect(r.episodios).toHaveLength(1)
  })
  it('atestado de 20 dias: 15 primeiros dias na taxa, o resto vira prolongado fora da taxa', () => {
    // 3 a 22/11: dias 3..17 na taxa (11 programados); 18..22 prolongado (5 corridos, 2 programados: 18 e 19)
    const r = calcularPeriodo(base({ atestados: [atestado({ data_fim: '2026-11-22' })] }))
    expect(r.jornadas_perdidas).toBe(11)
    expect(r.disponibilidade_dias.atestado_prolongado).toBe(5)
    expect(r.jornadas_programadas).toBe(17)
  })
  it('atestados emendados são 1 episódio só', () => {
    const r = calcularPeriodo(base({
      atestados: [atestado({ id: 'a', data_inicio: '2026-11-03', data_fim: '2026-11-04' }), atestado({ id: 'b', data_inicio: '2026-11-05', data_fim: '2026-11-06' })],
    }))
    expect(r.episodios).toHaveLength(1)
    expect(r.episodios[0].origem_ids).toEqual(['a', 'b'])
    expect(r.jornadas_perdidas).toBe(4)
  })
  it('falta no mesmo dia de atestado: o dia fica com o atestado, sem episódio de falta', () => {
    const r = calcularPeriodo(base({
      atestados: [atestado({ data_inicio: '2026-11-03', data_fim: '2026-11-05' })],
      faltas: [falta({ data_falta: '2026-11-04' })],
    }))
    expect(r.jornadas_perdidas).toBe(3)
    expect(r.perdidas_por_classe.falta_injustificada).toBe(0)
    expect(r.episodios).toHaveLength(1)
    expect(r.episodios[0].classe).toBe('atestado')
  })
})

describe('calcularPeriodo — disponibilidade (fora da taxa)', () => {
  it('afastamento INSS aberto desde 10/11: 21 dias corridos, 5 jornadas programadas', () => {
    const r = calcularPeriodo(base({ afastamentos: [afast()] }))
    expect(r.disponibilidade_dias.afastamento_inss).toBe(21)
    expect(r.jornadas_programadas).toBe(5)
    expect(r.jornadas_perdidas).toBe(0)
    expect(r.episodios).toEqual([])
    expect(r.indisponiveis_dias_pessoa).toBe(21)
  })
  it('afastamento vence atestado no mesmo dia', () => {
    const r = calcularPeriodo(base({
      afastamentos: [afast({ data_inicio: '2026-11-03', data_fim_real: '2026-11-10' })],
      atestados: [atestado({ data_inicio: '2026-11-03', data_fim: '2026-11-05' })],
    }))
    expect(r.jornadas_perdidas).toBe(0)
    expect(r.episodios).toEqual([])
    expect(r.disponibilidade_dias.afastamento_inss).toBe(8)
  })
  it('afastamento fechado termina em data_fim_real', () => {
    const r = calcularPeriodo(base({ afastamentos: [afast({ data_inicio: '2026-11-03', data_fim_real: '2026-11-05' })] }))
    expect(r.disponibilidade_dias.afastamento_inss).toBe(3)
  })
  it('classes de afastamento: licença legal e outros', () => {
    const r = calcularPeriodo(base({
      funcionarios: [F({ id: 'f1' }), F({ id: 'f2' })],
      afastamentos: [
        afast({ id: 'x', motivo: 'Licença Maternidade', data_inicio: '2026-11-01', data_fim_real: '2026-11-03' }),
        { ...afast({ id: 'y', motivo: 'Outros', data_inicio: '2026-11-01', data_fim_real: '2026-11-02' }), funcionario_id: 'f2' },
      ],
    }))
    expect(r.disponibilidade_dias.licenca_legal).toBe(3)
    expect(r.disponibilidade_dias.afastamento_outros).toBe(2)
  })
  it('férias de 9 a 20/11: 12 dias corridos, 9 jornadas fora da base', () => {
    const r = calcularPeriodo(base({ ferias: [{ id: 'fe1', funcionario_id: 'f1', data_inicio: '2026-11-09', data_fim: '2026-11-20' }] }))
    expect(r.disponibilidade_dias.ferias).toBe(12)
    expect(r.jornadas_programadas).toBe(10)
    expect(r.jornadas_perdidas).toBe(0)
  })
})

describe('calcularPeriodo — suspensão (fora da taxa)', () => {
  it('falta tipo suspensao não é perdida nem programada', () => {
    const r = calcularPeriodo(base({ faltas: [falta({ tipo: 'suspensao', data_falta: '2026-11-24', data_fim: '2026-11-25', dias: 2 })] }))
    expect(r.suspensao_jornadas).toBe(2)
    expect(r.jornadas_perdidas).toBe(0)
    expect(r.jornadas_programadas).toBe(17)
    expect(r.episodios).toEqual([])
  })
  it('advertência de suspensão: primeiros N dias programados a partir da data', () => {
    const r = calcularPeriodo(base({ suspensoes: [{ id: 's1', funcionario_id: 'f1', data_inicio: '2026-11-24', dias: 2 }] }))
    expect(r.suspensao_jornadas).toBe(2)
    expect(r.jornadas_programadas).toBe(17)
  })
  it('advertência de suspensão na 5x1 usa o ciclo ancorado no início da janela', () => {
    // 5x1 ancorada em 01/11: programados 1,3,4,5,7-11,13,14,16,17,19,21,22,23,25-29 = 22
    // suspensos: 3,4,5,7,8 (o dia 6 é folga do ciclo)
    const r = calcularPeriodo(base({
      funcionarios: [F({ regime: '5x1' })],
      suspensoes: [{ id: 's1', funcionario_id: 'f1', data_inicio: '2026-11-03', dias: 5 }],
    }))
    expect(r.suspensao_jornadas).toBe(5)
    expect(r.jornadas_programadas).toBe(17)
  })
  it('advertência com dias negativo é ignorada', () => {
    const r = calcularPeriodo(base({
      suspensoes: [{ id: 's1', funcionario_id: 'f1', data_inicio: '2026-11-03', dias: -2 }],
    }))
    expect(r.suspensao_jornadas).toBe(0)
    expect(r.jornadas_programadas).toBe(19)
  })
})

describe('calcularPeriodo — entradas inconsistentes', () => {
  it('funcionário duplicado na lista conta uma vez só', () => {
    const r = calcularPeriodo(base({ funcionarios: [F(), F()], faltas: [falta()] }))
    expect(r.jornadas_programadas).toBe(19)
    expect(r.quadro_medio).toBe(1)
    expect(r.episodios).toHaveLength(1)
  })
  it('falta com data_fim anterior a data_falta usa data_falta + dias - 1', () => {
    const r = calcularPeriodo(base({ faltas: [falta({ data_falta: '2026-11-10', data_fim: '2026-11-05', dias: 1 })] }))
    expect(r.episodios).toHaveLength(1)
    expect(r.jornadas_perdidas).toBe(1)
  })
})

describe('calcularPeriodo — janela do funcionário', () => {
  it('admitido em 16/11: 10 jornadas e quadro médio 0,5', () => {
    const r = calcularPeriodo(base({ funcionarios: [F({ admissao: '2026-11-16' })] }))
    expect(r.jornadas_programadas).toBe(10)
    expect(r.quadro_medio).toBe(0.5)
  })
  it('desligado em 10/11: 5 jornadas (3,4,5,6,9)', () => {
    const r = calcularPeriodo(base({ funcionarios: [F({ desligamento: '2026-11-10' })] }))
    expect(r.jornadas_programadas).toBe(5)
  })
  it('fora_do_quadro é ignorado inclusive nas ausências', () => {
    const r = calcularPeriodo(base({ funcionarios: [F({ fora_do_quadro: true })], faltas: [falta()] }))
    expect(r.jornadas_programadas).toBe(0)
    expect(r.episodios).toEqual([])
  })
  it('período parcial (1 a 19/11): programadas só até o dia 19 = 13', () => {
    const r = calcularPeriodo(base({ fim: '2026-11-19' }))
    expect(r.jornadas_programadas).toBe(13)
  })
})

describe('calcularPeriodo — escalas', () => {
  it('12x36 conta todos os dias menos feriados (27 em novembro)', () => {
    const r = calcularPeriodo(base({ funcionarios: [F({ regime: '12x36' })] }))
    expect(r.jornadas_programadas).toBe(27)
  })
  it('falta em fim de semana na 5x2: 0 jornadas, mas o episódio existe', () => {
    const r = calcularPeriodo(base({ faltas: [falta({ data_falta: '2026-11-07' })] }))
    expect(r.jornadas_perdidas).toBe(0)
    expect(r.episodios).toHaveLength(1)
    expect(r.episodios[0].jornadas).toBe(0)
  })
})
