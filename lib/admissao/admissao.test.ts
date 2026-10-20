import { describe, it, expect } from 'vitest'
import { validarCpf, formatarCpf, formatarCep, formatarTelefone, apenasDigitos } from './cpf'
import { numeroBR, totaisVT } from './vt'
import { horarioParaCadastro } from './horario'
import { errosDaEtapa, errosDoDossie } from './validar'
import { dossieVazio, type DossieAdmissao } from './tipos'

describe('cpf', () => {
  it('aceita CPF válido com ou sem máscara', () => {
    expect(validarCpf('529.982.247-25')).toBe(true)
    expect(validarCpf('52998224725')).toBe(true)
  })
  it('recusa dígito errado, tamanho errado e sequência repetida', () => {
    expect(validarCpf('529.982.247-24')).toBe(false)
    expect(validarCpf('5299822472')).toBe(false)
    expect(validarCpf('111.111.111-11')).toBe(false)
    expect(validarCpf('')).toBe(false)
    expect(validarCpf(null)).toBe(false)
  })
  it('mascara enquanto digita', () => {
    expect(formatarCpf('5299')).toBe('529.9')
    expect(formatarCpf('52998224725')).toBe('529.982.247-25')
    expect(formatarCpf('529982247259999')).toBe('529.982.247-25')
    expect(apenasDigitos('529.982.247-25')).toBe('52998224725')
  })
  it('mascara CEP e telefone', () => {
    expect(formatarCep('01310100')).toBe('01310-100')
    expect(formatarTelefone('11987654321')).toBe('(11) 98765-4321')
    expect(formatarTelefone('1133334444')).toBe('(11) 3333-4444')
  })
})

describe('vale transporte', () => {
  it('lê números no formato brasileiro', () => {
    expect(numeroBR('4,50')).toBe(4.5)
    expect(numeroBR('R$ 1.234,56')).toBe(1234.56)
    expect(numeroBR('4.5')).toBe(4.5)
    expect(numeroBR('')).toBeNull()
    expect(numeroBR('abc')).toBeNull()
  })
  it('soma valor do dia e passagens, ignorando linha em branco', () => {
    const linhas = [
      { tipo: 'Ônibus', linha: '101', empresa: 'X', valor: '4,40', qtd: '2' },
      { tipo: 'Metrô', linha: 'Azul', empresa: 'Y', valor: '5,00', qtd: '2' },
      { tipo: 'Ônibus', linha: '', empresa: '', valor: '', qtd: '2' },
    ]
    expect(totaisVT(linhas)).toEqual({ valorDia: 18.8, passagensDia: 4 })
  })
})

const base = {
  hora_entrada: '07:00:00', hora_saida_seg_qui: '16:00:00', hora_saida_sex: null,
  hora_inicio_almoco: '11:00:00', hora_fim_almoco: '12:00:00',
}

describe('horarioParaCadastro', () => {
  it('5x1 com almoço: dois períodos, segunda a sexta, marca 5x1 ou 6x1', () => {
    const h = horarioParaCadastro({ ...base, tipo_escala: '5x1' })
    expect(h.dias).toBe('seg_sex')
    expect(h.periodo1).toEqual({ entrada: '07:00', saida: '11:00' })
    expect(h.periodo2).toEqual({ entrada: '12:00', saida: '16:00' })
    expect(h.sexta).toBeNull()
    expect(h.escala5x1).toBe(true)
    expect(h.escalaOutra).toBeNull()
  })
  it('sem almoço: período único na primeira coluna', () => {
    const h = horarioParaCadastro({ ...base, hora_inicio_almoco: null, hora_fim_almoco: null, tipo_escala: '5x1' })
    expect(h.periodo1).toEqual({ entrada: '07:00', saida: '16:00' })
    expect(h.periodo2).toBeNull()
  })
  it('5x2 com saída própria na sexta vira segunda a quinta + sexta', () => {
    const h = horarioParaCadastro({ ...base, tipo_escala: '5x2', hora_saida_sex: '15:00:00' })
    expect(h.dias).toBe('seg_qui')
    expect(h.sexta).toEqual({ entrada: '07:00', saida: '15:00', pausa: null })
    expect(h.escalaOutra).toBe('5x2')
    expect(h.escala5x1).toBe(false)
  })
  it('6x1 com sexta e sábado próprios (CRESCER CENTRO)', () => {
    const h = horarioParaCadastro({
      tipo_escala: '5x1', hora_entrada: '13:00:00', hora_saida_seg_qui: '22:00:00', hora_saida_sex: '17:00:00',
      hora_inicio_almoco: '18:00:00', hora_fim_almoco: '19:00:00',
      hora_entrada_sex: '09:00:00', hora_inicio_almoco_sex: '12:00:00', hora_fim_almoco_sex: '13:00:00',
      hora_entrada_sabado: '12:00:00', hora_saida_sabado: '17:00:00',
      hora_inicio_almoco_sabado: null, hora_fim_almoco_sabado: null,
    })
    expect(h.dias).toBe('seg_qui')
    expect(h.sexta).toEqual({ entrada: '09:00', saida: '17:00', pausa: '12:00–13:00' })
    expect(h.sabado).toEqual({ entrada: '12:00', saida: '17:00', pausa: null })
  })
  it('12x36 não marca dia da semana e escreve a escala', () => {
    const h = horarioParaCadastro({ ...base, tipo_escala: '12x36', hora_saida_seg_qui: '19:00:00', hora_inicio_almoco: null, hora_fim_almoco: null })
    expect(h.dias).toBeNull()
    expect(h.escalaOutra).toBe('12x36')
    expect(h.sexta).toBeNull()
  })
  it('jovem aprendiz: segunda a sexta, período único', () => {
    const h = horarioParaCadastro({ ...base, tipo_escala: 'jovem_aprendiz', hora_saida_seg_qui: '11:00:00', hora_inicio_almoco: null, hora_fim_almoco: null })
    expect(h.dias).toBe('seg_sex')
    expect(h.periodo1).toEqual({ entrada: '07:00', saida: '11:00' })
    expect(h.escalaOutra).toBe('Jovem Aprendiz')
  })
})

function dossieOk(): DossieAdmissao {
  return {
    ...dossieVazio('2026-11-03'),
    nome: 'MARIA DA SILVA', cpf: '52998224725', telefone: '11987654321', email: '',
    cep: '01310100', logradouro: 'Av. Paulista', numero: '1000', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP',
    posto_id: 'p1', funcao_id: 'f1', data_admissao: '2026-11-03',
    vt_linhas: [{ tipo: 'Ônibus', linha: '101', empresa: 'SPTrans', valor: '4,40', qtd: '2' }],
  }
}
const opcoes = { turnoObrigatorio: false, jovemAprendiz: false }

describe('validação do dossiê', () => {
  it('dossiê completo passa em todas as etapas', () => {
    expect(errosDoDossie(dossieOk(), opcoes)).toEqual([])
  })
  it('etapa 1 aponta CPF, telefone e CEP inválidos', () => {
    const d = { ...dossieOk(), cpf: '11111111111', telefone: '123', cep: '0131' }
    const e = errosDaEtapa(1, d, opcoes)
    expect(e).toEqual(expect.arrayContaining(['CPF inválido', 'Telefone com DDD inválido', 'CEP inválido']))
  })
  it('nome precisa de pelo menos duas palavras', () => {
    expect(errosDaEtapa(1, { ...dossieOk(), nome: 'MARIA' }, opcoes)).toContain('Informe o nome completo')
  })
  it('substituição exige o nome de quem sai', () => {
    const d = { ...dossieOk(), motivo: 'substituicao' as const }
    expect(errosDaEtapa(2, d, opcoes)).toContain('Informe quem está sendo substituído')
    expect(errosDaEtapa(2, { ...d, substituido_nome: 'JOSE' }, opcoes)).toEqual([])
  })
  it('turno é obrigatório só quando o posto tem turno', () => {
    expect(errosDaEtapa(2, dossieOk(), { turnoObrigatorio: true, jovemAprendiz: false })).toContain('Selecione o turno de trabalho')
    expect(errosDaEtapa(2, dossieOk(), opcoes)).toEqual([])
  })
  it('jovem aprendiz com turno exige dia de curso', () => {
    const d = { ...dossieOk(), turno_id: 't1' }
    expect(errosDaEtapa(2, d, { turnoObrigatorio: true, jovemAprendiz: true })).toContain('Selecione o dia de curso')
  })
  it('VT: utiliza sem nenhuma linha é erro; "não utiliza" dispensa tudo', () => {
    const semLinha = { ...dossieOk(), vt_linhas: [{ tipo: 'Ônibus', linha: '', empresa: '', valor: '', qtd: '2' }] }
    expect(errosDaEtapa(4, semLinha, opcoes)).toHaveLength(1)
    expect(errosDaEtapa(4, { ...semLinha, vt_utiliza: false }, opcoes)).toEqual([])
  })
  it('VT: linha preenchida pela metade acusa o que falta; cartão "outro" pede o nome', () => {
    const d = { ...dossieOk(), vt_linhas: [{ tipo: 'Ônibus', linha: '101', empresa: '', valor: '', qtd: '' }], vt_cartao: 'outro' as const }
    const e = errosDaEtapa(4, d, opcoes)
    expect(e).toEqual(expect.arrayContaining([
      'Informe o valor da passagem de cada linha',
      'Informe a quantidade de passagens por dia de cada linha',
      'Informe qual é o cartão',
    ]))
  })
  it('data da integração inválida é erro na revisão', () => {
    expect(errosDaEtapa(6, { ...dossieOk(), data_integracao: '2026-02-30' }, opcoes)).toContain('Informe a data da integração')
  })
})
