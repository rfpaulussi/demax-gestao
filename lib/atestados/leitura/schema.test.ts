import { describe, it, expect } from 'vitest'
import { lerExtracaoAtestado, FERRAMENTA_ATESTADO } from './schema'

const valido = {
  tipo_documento: 'atestado_medico',
  paciente_nome: ' ANA TESTE ',
  paciente_cpf: '529.982.247-25',
  paciente_menor: false,
  mae_nome: null,
  data_inicio: '2026-10-21',
  origem_data_inicio: 'explicita',
  dias: 2,
  cid: 'R11',
  observacao: null,
}

describe('lerExtracaoAtestado', () => {
  it('lê uma resposta completa e limpa os textos', () => {
    expect(lerExtracaoAtestado(valido)).toEqual({
      tipoDocumento: 'atestado_medico', pacienteNome: 'ANA TESTE', pacienteCpf: '52998224725', pacienteMenor: false,
      maeNome: null, dataInicio: '2026-10-21', origemDataInicio: 'explicita', dias: 2, cid: 'R11', observacao: null,
    })
  })
  it('devolve null quando não é objeto', () => {
    expect(lerExtracaoAtestado(null)).toBeNull()
    expect(lerExtracaoAtestado('texto')).toBeNull()
  })
  it('dias só vale se for inteiro', () => {
    expect(lerExtracaoAtestado({ ...valido, dias: '2' })?.dias).toBeNull()
    expect(lerExtracaoAtestado({ ...valido, dias: 2.5 })?.dias).toBeNull()
  })
  it('data fora do formato AAAA-MM-DD vira null', () => {
    expect(lerExtracaoAtestado({ ...valido, data_inicio: '21/10/2026' })?.dataInicio).toBeNull()
    expect(lerExtracaoAtestado({ ...valido, data_inicio: '2026-02-30' })?.dataInicio).toBeNull()
  })
  it('tipo desconhecido vira "outro"', () => {
    expect(lerExtracaoAtestado({ ...valido, tipo_documento: 'receita' })?.tipoDocumento).toBe('outro')
  })
  it('CPF só vale com 11 dígitos', () => {
    expect(lerExtracaoAtestado({ ...valido, paciente_cpf: '123' })?.pacienteCpf).toBeNull()
  })
  it('texto vazio vira null e menor não-booleano vira null', () => {
    const r = lerExtracaoAtestado({ ...valido, mae_nome: '  ', paciente_menor: 'sim' })
    expect(r?.maeNome).toBeNull()
    expect(r?.pacienteMenor).toBeNull()
  })
  it('origem da data só aceita explicita ou emissao', () => {
    expect(lerExtracaoAtestado({ ...valido, origem_data_inicio: 'chute' })?.origemDataInicio).toBeNull()
  })
  it('origem da data "emissao" é aceita', () => {
    expect(lerExtracaoAtestado({ ...valido, origem_data_inicio: 'emissao' })?.origemDataInicio).toBe('emissao')
  })
  it('array e undefined são entrada inválida', () => {
    expect(lerExtracaoAtestado([])).toBeNull()
    expect(lerExtracaoAtestado([valido])).toBeNull()
    expect(lerExtracaoAtestado(undefined)).toBeNull()
  })
  it('objeto vazio não lança e devolve tudo null (tipo "outro")', () => {
    expect(lerExtracaoAtestado({})).toEqual({
      tipoDocumento: 'outro', pacienteNome: null, pacienteCpf: null, pacienteMenor: null,
      maeNome: null, dataInicio: null, origemDataInicio: null, dias: null, cid: null, observacao: null,
    })
  })
  it('dias NaN e Infinity viram null', () => {
    expect(lerExtracaoAtestado({ ...valido, dias: NaN })?.dias).toBeNull()
    expect(lerExtracaoAtestado({ ...valido, dias: Infinity })?.dias).toBeNull()
  })
  it('CPF com mais de 11 dígitos vira null', () => {
    expect(lerExtracaoAtestado({ ...valido, paciente_cpf: '529982247251' })?.pacienteCpf).toBeNull()
  })
  it('data com hora vira null', () => {
    expect(lerExtracaoAtestado({ ...valido, data_inicio: '2026-10-21T10:00' })?.dataInicio).toBeNull()
  })
})

describe('FERRAMENTA_ATESTADO', () => {
  const { properties, required } = FERRAMENTA_ATESTADO.input_schema
  it('não tem data_retorno nem campos confianca_*', () => {
    const chaves = Object.keys(properties)
    expect(chaves).not.toContain('data_retorno')
    expect(chaves.filter((k) => k.startsWith('confianca_'))).toEqual([])
  })
  it('exige exatamente os campos combinados (paciente_menor fica opcional)', () => {
    expect([...required].sort()).toEqual(
      ['tipo_documento', 'paciente_nome', 'data_inicio', 'dias', 'cid', 'origem_data_inicio'].sort(),
    )
  })
})
