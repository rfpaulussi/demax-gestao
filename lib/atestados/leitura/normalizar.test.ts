import { describe, it, expect } from 'vitest'
import { dataValida, somarDias, diferencaDias, normalizarCid, prepararPreenchimento } from './normalizar'
import type { LeituraAtestado } from './tipos'

const HOJE = '2026-10-22'

const leitura = (extra: Partial<LeituraAtestado> = {}): LeituraAtestado => ({
  tipoDocumento: 'atestado_medico', pacienteNome: 'ANA TESTE', pacienteCpf: null, pacienteMenor: false, maeNome: null,
  dataInicio: '2026-10-21', origemDataInicio: 'explicita', dias: 2, cid: 'R11', observacao: null, ...extra,
})

describe('datas', () => {
  it('dataValida confere formato e calendário', () => {
    expect(dataValida('2026-10-22')).toBe(true)
    expect(dataValida('2026-02-30')).toBe(false)
    expect(dataValida('22/10/2026')).toBe(false)
    expect(dataValida(null)).toBe(false)
  })
  it('somarDias atravessa mês e ano', () => {
    expect(somarDias('2026-10-30', 2)).toBe('2026-11-01')
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somarDias('2026-10-22', 0)).toBe('2026-10-22')
  })
  it('diferencaDias é B − A em dias', () => {
    expect(diferencaDias('2026-10-20', '2026-10-22')).toBe(2)
    expect(diferencaDias('2026-10-22', '2026-10-20')).toBe(-2)
  })
})

describe('normalizarCid', () => {
  const ref = new Set(['J39', 'A09', 'I51.7', 'R11', 'S50', 'M45'])
  it('põe o ponto e acha exato', () => {
    expect(normalizarCid('I517', ref)).toEqual({ codigo: 'I51.7', lido: 'I51.7', aproximado: false })
    expect(normalizarCid('a09', ref)).toEqual({ codigo: 'A09', lido: 'A09', aproximado: false })
  })
  it('ignora espaço dentro do código', () => {
    expect(normalizarCid('S 50', ref)).toEqual({ codigo: 'S50', lido: 'S50', aproximado: false })
  })
  it('cai na categoria quando a subcategoria não está na referência', () => {
    expect(normalizarCid('J399', ref)).toEqual({ codigo: 'J39', lido: 'J39.9', aproximado: true })
  })
  it('aceita vírgula no lugar do ponto', () => {
    expect(normalizarCid('J39,9', ref)).toEqual({ codigo: 'J39', lido: 'J39.9', aproximado: true })
  })
  it('aceita subcódigo de dois dígitos e cai na categoria', () => {
    expect(normalizarCid('J39.99', ref)).toEqual({ codigo: 'J39', lido: 'J39.99', aproximado: true })
  })
  it('ignora prefixo "CID" e aceita outros separadores', () => {
    expect(normalizarCid('CID: I517', ref)).toEqual({ codigo: 'I51.7', lido: 'I51.7', aproximado: false })
    expect(normalizarCid('cid-10 a09', ref)).toEqual({ codigo: 'A09', lido: 'A09', aproximado: false })
    expect(normalizarCid('I51-7', ref)).toEqual({ codigo: 'I51.7', lido: 'I51.7', aproximado: false })
    expect(normalizarCid('I51/7', ref)).toEqual({ codigo: 'I51.7', lido: 'I51.7', aproximado: false })
    expect(normalizarCid('I 51 7', ref)).toEqual({ codigo: 'I51.7', lido: 'I51.7', aproximado: false })
  })
  it('acha faixa cadastrada como está (ex.: S00-T98)', () => {
    expect(normalizarCid('s00-t98', new Set(['S00-T98']))).toEqual({ codigo: 'S00-T98', lido: 'S00-T98', aproximado: false })
  })
  it('"CID" sozinho, sem código, vira ausente', () => {
    expect(normalizarCid('CID', ref)).toEqual({ codigo: null, lido: null, aproximado: false })
  })
  it('devolve código nulo quando não está na referência nem tem categoria', () => {
    expect(normalizarCid('K80', ref)).toEqual({ codigo: null, lido: 'K80', aproximado: false })
  })
  it('texto que não parece CID fica como lido', () => {
    expect(normalizarCid('XYZ', ref)).toEqual({ codigo: null, lido: 'XYZ', aproximado: false })
    expect(normalizarCid(null, ref)).toEqual({ codigo: null, lido: null, aproximado: false })
  })
})

describe('prepararPreenchimento', () => {
  const ref = new Set(['R11', 'J39'])

  it('caso normal: sem avisos e com data fim = início + dias − 1', () => {
    const p = prepararPreenchimento(leitura(), HOJE, ref)
    expect(p).toEqual({
      dataInicio: '2026-10-21', dias: '2', dataFim: '2026-10-22', cidCodigo: 'R11',
      avisos: { dataInicio: null, dias: null, cid: null },
    })
  })

  it('início assumido da emissão fica com aviso', () => {
    const p = prepararPreenchimento(leitura({ dataInicio: '2026-10-22', origemDataInicio: 'emissao', dias: 30 }), HOJE, ref)
    expect(p.dataFim).toBe('2026-11-20')
    expect(p.avisos.dataInicio).toContain('emissão')
  })

  it('início muito antigo ou muito à frente fica com aviso', () => {
    expect(prepararPreenchimento(leitura({ dataInicio: '2026-07-01' }), HOJE, ref).avisos.dataInicio).toContain('60 dias')
    expect(prepararPreenchimento(leitura({ dataInicio: '2026-12-01' }), HOJE, ref).avisos.dataInicio).toContain('30 dias')
  })

  it('início ilegível: campo vazio, sem data fim e com aviso', () => {
    const p = prepararPreenchimento(leitura({ dataInicio: null, origemDataInicio: null }), HOJE, ref)
    expect(p.dataInicio).toBe('')
    expect(p.dataFim).toBe('')
    expect(p.avisos.dataInicio).toContain('Não consegui ler')
  })

  it('dias fora de 1 a 365 ou ausente: vazio, sem data fim e com aviso', () => {
    for (const dias of [0, 400, null]) {
      const p = prepararPreenchimento(leitura({ dias }), HOJE, ref)
      expect(p.dias).toBe('')
      expect(p.dataFim).toBe('')
      expect(p.avisos.dias).toContain('Não consegui ler')
    }
  })

  it('sem CID no papel: campo vazio e aviso, nunca "sem CID" automático', () => {
    const p = prepararPreenchimento(leitura({ cid: null }), HOJE, ref)
    expect(p.cidCodigo).toBe('')
    expect(p.avisos.cid).toContain('Não achei CID')
  })

  it('CID aproximado pela categoria avisa qual foi lido', () => {
    const p = prepararPreenchimento(leitura({ cid: 'J399' }), HOJE, ref)
    expect(p.cidCodigo).toBe('J39')
    expect(p.avisos.cid).toContain('J39.9')
  })

  it('CID só com espaços conta como ausente', () => {
    const p = prepararPreenchimento(leitura({ cid: '   ' }), HOJE, ref)
    expect(p.cidCodigo).toBe('')
    expect(p.avisos.cid).toContain('Não achei CID')
  })

  it('fronteiras de data: 60 dias atrás e 30 dias à frente não avisam; um dia além avisa', () => {
    expect(prepararPreenchimento(leitura({ dataInicio: '2026-08-23' }), HOJE, ref).avisos.dataInicio).toBeNull()
    expect(prepararPreenchimento(leitura({ dataInicio: '2026-08-22' }), HOJE, ref).avisos.dataInicio).toContain('60 dias')
    expect(prepararPreenchimento(leitura({ dataInicio: '2026-11-21' }), HOJE, ref).avisos.dataInicio).toBeNull()
    expect(prepararPreenchimento(leitura({ dataInicio: '2026-11-22' }), HOJE, ref).avisos.dataInicio).toContain('30 dias')
  })

  it('dias 1 e 365 são válidos', () => {
    const um = prepararPreenchimento(leitura({ dias: 1 }), HOJE, ref)
    expect(um.dias).toBe('1')
    expect(um.dataFim).toBe('2026-10-21')
    expect(um.avisos.dias).toBeNull()
    const ano = prepararPreenchimento(leitura({ dias: 365 }), HOJE, ref)
    expect(ano.dias).toBe('365')
    expect(ano.dataFim).toBe('2027-10-20')
    expect(ano.avisos.dias).toBeNull()
  })

  it('CID fora da referência: vazio e aviso com o código lido', () => {
    const p = prepararPreenchimento(leitura({ cid: 'K80' }), HOJE, ref)
    expect(p.cidCodigo).toBe('')
    expect(p.avisos.cid).toContain('K80')
    expect(p.avisos.cid).toContain('não está cadastrado')
  })

  it('CID lido muito longo é cortado no aviso', () => {
    const longo = 'X'.repeat(60)
    const p = prepararPreenchimento(leitura({ cid: longo }), HOJE, ref)
    expect(p.avisos.cid).toContain('X'.repeat(12))
    expect(p.avisos.cid).not.toContain(longo)
    expect(p.avisos.cid).not.toContain('X'.repeat(13))
  })
})
