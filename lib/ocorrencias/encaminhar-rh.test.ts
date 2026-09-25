import { describe, it, expect } from 'vitest'
import {
  montarRascunhoRH,
  validarEmails,
  diasComRH,
  corpoParaHtml,
  type DadosRascunhoRH,
} from './encaminhar-rh'

const base: DadosRascunhoRH = {
  remetenteNome: 'Rodolfo Paulussi',
  funcionarioNome: 'Maria Souza',
  registro: '103152',
  funcao: 'Servente',
  postoNome: 'EM Maria Luiza',
  secretaria: 'SME',
  dataOcorrencia: '2026-09-17',
  gravidade: 'Média',
  supervisorNome: 'CRISL',
  textoOcorrencia: 'Colaboradora apresentou nova crise na unidade.',
  advertencias: [],
  atestados: [],
  faltas: [],
}

describe('montarRascunhoRH', () => {
  it('abre com a saudação à Coordenadora de RH e fecha com o remetente', () => {
    const { corpo } = montarRascunhoRH(base)
    expect(corpo.startsWith('Prezada Coordenadora de RH,')).toBe(true)
    expect(corpo).toContain('Atenciosamente,\nRodolfo Paulussi')
  })

  it('traz colaborador, posto, função, RE, supervisor e o relato', () => {
    const { corpo } = montarRascunhoRH(base)
    expect(corpo).toContain('Maria Souza')
    expect(corpo).toContain('103152')
    expect(corpo).toContain('Servente')
    expect(corpo).toContain('EM Maria Luiza')
    expect(corpo).toContain('SME')
    expect(corpo).toContain('CRISL')
    expect(corpo).toContain('17/09/2026')
    expect(corpo).toContain('Média')
    expect(corpo).toContain('Colaboradora apresentou nova crise na unidade.')
  })

  it('o assunto cita o colaborador e o RE', () => {
    expect(montarRascunhoRH(base).assunto).toBe('Ocorrência — Maria Souza (RE 103152)')
  })

  it('o assunto não quebra sem RE', () => {
    expect(montarRascunhoRH({ ...base, registro: null }).assunto).toBe('Ocorrência — Maria Souza')
  })

  it('diz "nenhuma" quando não há histórico', () => {
    const { corpo } = montarRascunhoRH(base)
    expect(corpo).toContain('Advertências: nenhuma')
    expect(corpo).toContain('Atestados: nenhum')
    expect(corpo).toContain('Faltas: nenhuma')
  })

  it('lista o histórico e calcula os dias de atestado (inclusive)', () => {
    const { corpo } = montarRascunhoRH({
      ...base,
      advertencias: [{ grau: 'Escrita', natureza: 'Falta Injustificada', data: '2026-08-10' }],
      atestados: [{ inicio: '2026-09-17', fim: '2026-09-30' }, { inicio: '2026-09-09', fim: null }],
      faltas: [{ tipo: 'Sem Justificativa', dias: 2, data: '2026-08-11' }],
    })
    expect(corpo).toContain('Escrita — Falta Injustificada (10/08/2026)')
    expect(corpo).toContain('17/09/2026 a 30/09/2026 (14 dias)')
    expect(corpo).toContain('09/09/2026 (1 dia)')
    expect(corpo).toContain('Sem Justificativa, 2 dia(s) (11/08/2026)')
  })

  it('NUNCA vaza dado que não é campo explícito (CPF, salário, CID) mesmo que venha no objeto', () => {
    const contaminado = {
      ...base,
      cpf: '123.456.789-09',
      salario: 4321.55,
      cid_codigo: 'F41.1',
      motivo: 'crise de ansiedade',
    } as unknown as DadosRascunhoRH
    const { assunto, corpo } = montarRascunhoRH(contaminado)
    const tudo = `${assunto}\n${corpo}`
    expect(tudo).not.toContain('123.456.789-09')
    expect(tudo).not.toContain('4321')
    expect(tudo).not.toContain('F41.1')
    expect(tudo).not.toContain('crise de ansiedade')
  })
})

describe('validarEmails', () => {
  it('aceita um e-mail', () => {
    expect(validarEmails('rh@demax.com.br')).toEqual({ ok: true, emails: ['rh@demax.com.br'] })
  })

  it('aceita vários separados por vírgula ou ponto e vírgula, sem repetir, em minúsculas', () => {
    expect(validarEmails('A@x.com; b@x.com, a@X.com')).toEqual({ ok: true, emails: ['a@x.com', 'b@x.com'] })
  })

  it('recusa vazio', () => {
    expect(validarEmails('  ')).toEqual({ ok: false, error: 'Informe o e-mail do destinatário' })
  })

  it('recusa endereço inválido e diz qual', () => {
    expect(validarEmails('rh@demax.com.br, semarroba')).toEqual({ ok: false, error: 'E-mail inválido: semarroba' })
  })

  it('recusa mais de 5 destinatários', () => {
    const r = validarEmails('a@x.com,b@x.com,c@x.com,d@x.com,e@x.com,f@x.com')
    expect(r.ok).toBe(false)
  })
})

describe('diasComRH', () => {
  it('conta dias inteiros desde o encaminhamento', () => {
    expect(diasComRH('2026-09-20T12:00:00Z', new Date('2026-09-25T13:00:00Z'))).toBe(5)
  })

  it('devolve 0 no mesmo dia e nunca negativo', () => {
    expect(diasComRH('2026-09-25T12:00:00Z', new Date('2026-09-25T13:00:00Z'))).toBe(0)
    expect(diasComRH('2026-09-30T12:00:00Z', new Date('2026-09-25T13:00:00Z'))).toBe(0)
  })
})

describe('corpoParaHtml', () => {
  it('escapa HTML e mantém as quebras de linha', () => {
    const html = corpoParaHtml('Linha 1\n<b>Linha 2</b>')
    expect(html).toContain('Linha 1<br>&lt;b&gt;Linha 2&lt;/b&gt;')
    expect(html).not.toContain('<b>')
  })
})
