import { describe, it, expect } from 'vitest'
import { montarContexto, montarContextoRetorno, type DadosContexto } from './contexto'

const base: DadosContexto = {
  funcao: 'Servente',
  dataOcorrencia: '2026-09-17',
  gravidade: 'Média',
  textoAnonimo: 'FUNC_1 apresentou uma crise na unidade.',
  historico: { advertencias: 2, diasAtestado12m: 19, faltas: 1 },
}

describe('montarContexto', () => {
  it('leva função, data, gravidade, contagens e o relato anonimizado', () => {
    const m = montarContexto(base)
    expect(m).toContain('Servente')
    expect(m).toContain('17/09/2026')
    expect(m).toContain('Média')
    expect(m).toContain('2 advertência(s)')
    expect(m).toContain('19 dia(s) de atestado')
    expect(m).toContain('1 falta(s)')
    expect(m).toContain('FUNC_1 apresentou uma crise na unidade.')
  })

  it('NUNCA leva campos que não são explícitos (nome, RE, CPF, posto, CID) mesmo se vierem no objeto', () => {
    const contaminado = {
      ...base,
      funcionarioNome: 'Maria Souza',
      registro: '103152',
      cpf: '123.456.789-09',
      postoNome: 'EM Maria Luiza',
      cid_codigo: 'F41.1',
    } as unknown as DadosContexto
    const m = montarContexto(contaminado)
    expect(m).not.toContain('Maria Souza')
    expect(m).not.toContain('103152')
    expect(m).not.toContain('123.456.789-09')
    expect(m).not.toContain('EM Maria Luiza')
    expect(m).not.toContain('F41.1')
  })

  it('aceita função e data ausentes', () => {
    const m = montarContexto({ ...base, funcao: null, dataOcorrencia: null, gravidade: null })
    expect(m).toContain('Função do colaborador: não informada')
  })
})

describe('montarContextoRetorno', () => {
  it('junta o contexto e a resposta anonimizada do RH', () => {
    const m = montarContextoRetorno({ contexto: 'CONTEXTO', respostaRhAnonima: 'Orientar consulta médica.' })
    expect(m).toContain('CONTEXTO')
    expect(m).toContain('Resposta do RH:')
    expect(m).toContain('Orientar consulta médica.')
  })
})
