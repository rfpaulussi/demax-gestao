import { describe, it, expect } from 'vitest'
import { casarFuncionarios, buscarPorNome, type FuncionarioParaCasar } from './casar-funcionario'

const f = (id: string, nome: string, extra: Partial<FuncionarioParaCasar> = {}): FuncionarioParaCasar => ({
  id, nome, cpf: null, postoId: `posto-${id}`, postoNome: 'EM TESTE', funcaoNome: 'AUXILIAR DE LIMPEZA', status: 'ativo', ...extra,
})

const entrada = (nome: string | null, extra = {}) => ({
  pacienteNome: nome, pacienteCpf: null, pacienteMenor: false, maeNome: null, ...extra,
})

const base = [
  f('1', 'ANA PAULA FERREIRA LIMA', { cpf: '529.982.247-25' }),
  f('3', 'CARLOS EDUARDO MOURA'),
  f('4', 'BEATRIZ HELENA ROCHA', { status: 'desligado' }),
  f('5', 'FERNANDA OLIVEIRA DA COSTA'),
]

describe('casarFuncionarios', () => {
  it('acha por nome exato ignorando acento e caixa, e pré-seleciona', () => {
    const r = casarFuncionarios(entrada('Carlos Eduardo Móura'), base)
    expect(r.candidatos[0].id).toBe('3')
    expect(r.automatico).toBe('3')
  })

  it('tolera uma letra trocada e ainda pré-seleciona', () => {
    const r = casarFuncionarios(entrada('CARLOS EDUARDO MOURRA'), base)
    expect(r.candidatos[0].id).toBe('3')
    expect(r.automatico).toBe('3')
  })

  it('nome do meio omitido vira lista, sem pré-seleção', () => {
    const r = casarFuncionarios(entrada('FERNANDA COSTA'), base)
    expect(r.candidatos.map(c => c.id)).toEqual(['5'])
    expect(r.automatico).toBeNull()
  })

  it('ignora desligado', () => {
    const r = casarFuncionarios(entrada('BEATRIZ HELENA ROCHA'), base)
    expect(r.candidatos).toEqual([])
    expect(r.automatico).toBeNull()
  })

  it('homônimos: lista os dois, sem pré-seleção', () => {
    const lista = [f('1', 'ANA PAULA FERREIRA LIMA'), f('2', 'ANA PAULA FERREIRA LIMA')]
    const r = casarFuncionarios(entrada('ANA PAULA FERREIRA LIMA'), lista)
    expect(r.candidatos).toHaveLength(2)
    expect(r.automatico).toBeNull()
  })

  it('CPF desempata homônimos', () => {
    const lista = [f('1', 'ANA PAULA FERREIRA LIMA', { cpf: '52998224725' }), f('2', 'ANA PAULA FERREIRA LIMA')]
    const r = casarFuncionarios(entrada('ANA PAULA FERREIRA LIMA', { pacienteCpf: '52998224725' }), lista)
    expect(r.automatico).toBe('1')
  })

  it('menor de idade: procura pela mãe e nunca pré-seleciona', () => {
    const r = casarFuncionarios(
      entrada('LUCAS PEREIRA DA SILVA NETO', { pacienteMenor: true, maeNome: 'Fernanda Oliveira da Costa' }),
      base,
    )
    expect(r.candidatos[0]).toMatchObject({ id: '5', viaMae: true })
    expect(r.automatico).toBeNull()
  })

  it('sem nome nenhum devolve vazio', () => {
    expect(casarFuncionarios(entrada(null), base)).toEqual({ candidatos: [], automatico: null })
  })

  it('não devolve o CPF do cadastro', () => {
    const r = casarFuncionarios(entrada('ANA PAULA FERREIRA LIMA'), base)
    expect(JSON.stringify(r)).not.toContain('52998224725')
    expect(JSON.stringify(r)).not.toContain('529.982')
  })
})

describe('casamento por CPF', () => {
  const ana = 'ANA PAULA FERREIRA LIMA'

  it('CPF mascarado no cadastro casa com CPF só em dígitos do papel e desempata homônimos', () => {
    const lista = [f('1', ana, { cpf: '529.982.247-25' }), f('2', ana)]
    const r = casarFuncionarios(entrada(ana, { pacienteCpf: '52998224725' }), lista)
    expect(r.automatico).toBe('1')
  })

  it('não vaza o CPF no caminho por CPF', () => {
    const lista = [f('1', ana, { cpf: '529.982.247-25' }), f('2', ana)]
    const r = casarFuncionarios(entrada(ana, { pacienteCpf: '52998224725' }), lista)
    expect(r.automatico).toBe('1')
    expect(JSON.stringify(r)).not.toContain('52998224725')
    expect(JSON.stringify(r)).not.toContain('529.982')
  })

  it('ignora o CPF de funcionário desligado', () => {
    const lista = [f('1', 'ZZZ YYY XXX', { cpf: '52998224725', status: 'desligado' })]
    const r = casarFuncionarios(entrada('OUTRO NOME QUALQUER', { pacienteCpf: '52998224725' }), lista)
    expect(r.candidatos).toEqual([])
    expect(r.automatico).toBeNull()
  })

  it('dois ativos com o mesmo CPF: não pré-seleciona', () => {
    const lista = [f('1', ana, { cpf: '52998224725' }), f('2', 'OUTRA PESSOA QUALQUER', { cpf: '529.982.247-25' })]
    const r = casarFuncionarios(entrada(ana, { pacienteCpf: '52998224725' }), lista)
    expect(r.automatico).toBeNull()
  })

  it('CPF inválido no papel não vira automático, mesmo igual ao do cadastro', () => {
    const lista = [f('1', 'ZZZ YYY XXX', { cpf: '00000000000' })]
    const r = casarFuncionarios(entrada('OUTRO NOME QUALQUER', { pacienteCpf: '00000000000' }), lista)
    expect(r.candidatos).toEqual([])
    expect(r.automatico).toBeNull()
  })
})

describe('fronteira da pré-seleção', () => {
  it('notas próximas (diferença < 0,08) com topo >= 0,90: não pré-seleciona', () => {
    // Notas de similaridadeNomes: 0,99 (nome igual, limitado) e 0,96875 (última parte com uma letra diferente).
    const lista = [f('1', 'MARIA JOSE SANTOS OLIVEIRA'), f('2', 'MARIA JOSE SANTOS OLIVEIRO')]
    const r = casarFuncionarios(entrada('MARIA JOSE SANTOS OLIVEIRA'), lista)
    expect(r.candidatos.map(c => c.id)).toEqual(['1', '2'])
    expect(r.candidatos[0].nota).toBeGreaterThanOrEqual(0.9)
    expect(r.candidatos[0].nota - r.candidatos[1].nota).toBeLessThan(0.08)
    expect(r.automatico).toBeNull()
  })
})

describe('buscarPorNome', () => {
  it('acha por pedaço do nome', () => {
    expect(buscarPorNome('eduardo', base).map(c => c.id)).toEqual(['3'])
  })
  it('exige 3 letras ou mais', () => {
    expect(buscarPorNome('ca', base)).toEqual([])
  })
  it('não traz desligado', () => {
    expect(buscarPorNome('beatriz', base)).toEqual([])
  })
})
