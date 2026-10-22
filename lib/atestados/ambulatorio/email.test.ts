import { describe, it, expect } from 'vitest'
import { montarEmailAmbulatorio, nomeDoAnexo, type DadosEmailAmbulatorio } from './email'

const base: DadosEmailAmbulatorio = {
  funcionarioNome: 'Maria Teste da Silva',
  registro: '1234',
  postoNome: 'Escola Modelo',
  secretaria: 'Educação',
  lancadoPor: 'Supervisor Exemplo',
  dataInicio: '2026-10-20',
  dataFim: '2026-10-22',
}

describe('montarEmailAmbulatorio', () => {
  it('monta o assunto com nome, posto e período', () => {
    expect(montarEmailAmbulatorio(base).assunto).toBe('Atestado – Maria Teste da Silva – Escola Modelo – 20/10/2026 a 22/10/2026')
  })

  it('usa a data única quando início e fim são iguais', () => {
    const { assunto } = montarEmailAmbulatorio({ ...base, dataFim: '2026-10-20' })
    expect(assunto.endsWith('– 20/10/2026')).toBe(true)
  })

  it('traz os dados no corpo, com os dias contados', () => {
    const { html } = montarEmailAmbulatorio(base)
    for (const trecho of ['Maria Teste da Silva', '1234', 'Escola Modelo', 'Educação', 'Supervisor Exemplo', '20/10/2026', '22/10/2026']) {
      expect(html).toContain(trecho)
    }
    expect(html).toMatch(/Dias<\/td><td[^>]*>3</)
  })

  it('omite linhas sem valor', () => {
    const { html } = montarEmailAmbulatorio({ ...base, registro: null, secretaria: null, lancadoPor: null })
    expect(html).not.toContain('Registro (RE)')
    expect(html).not.toContain('Secretaria')
    expect(html).not.toContain('Lançado por')
  })

  it('escapa HTML vindo do banco', () => {
    const { html } = montarEmailAmbulatorio({ ...base, postoNome: '<img src=x onerror=alert(1)>', funcionarioNome: 'A & B' })
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
    expect(html).toContain('A &amp; B')
  })

  it('não deixa quebra de linha no assunto', () => {
    const { assunto } = montarEmailAmbulatorio({ ...base, postoNome: 'Posto\r\nBcc: x@y.com' })
    expect(assunto).not.toMatch(/[\r\n]/)
  })

  it('marca o e-mail de teste no assunto e no corpo', () => {
    const { assunto, html } = montarEmailAmbulatorio({ ...base, teste: true })
    expect(assunto.startsWith('[TESTE] Atestado')).toBe(true)
    expect(html).toContain('E-mail de teste')
    expect(montarEmailAmbulatorio(base).assunto.startsWith('Atestado')).toBe(true)
  })

  it('não tem CPF nem CID', () => {
    const { html, assunto } = montarEmailAmbulatorio(base)
    expect(html + assunto).not.toMatch(/CPF|CID/i)
  })
})

describe('nomeDoAnexo', () => {
  it('tira acento e símbolos', () => {
    expect(nomeDoAnexo('José d\'Ávila Júnior', 'image/jpeg')).toBe('atestado-jose-d-avila-junior.jpg')
  })

  it('usa a extensão do tipo', () => {
    expect(nomeDoAnexo('Ana', 'application/pdf')).toBe('atestado-ana.pdf')
    expect(nomeDoAnexo('Ana', 'image/png')).toBe('atestado-ana.png')
    expect(nomeDoAnexo('Ana', 'image/webp')).toBe('atestado-ana.webp')
  })

  it('cai num nome genérico quando não sobra nada', () => {
    expect(nomeDoAnexo('???', 'image/jpeg')).toBe('atestado-funcionario.jpg')
  })
})
