import { describe, expect, it } from 'vitest'
import { nomeArquivoAcordo } from './nome-arquivo'

describe('nomeArquivoAcordo', () => {
  it('título, supervisor e data, sem acento nem símbolo', () => {
    expect(nomeArquivoAcordo({ titulo: 'Descanso trabalhado: Eleições (04/10)', criado_por_nome: 'Crislaine Souza', data_documento: '2026-10-01' }))
      .toBe('acordo_descanso-trabalhado-eleicoes-04-10_crislaine-souza_01-10-2026.pdf')
  })
  it('sem supervisor, a parte some', () => {
    expect(nomeArquivoAcordo({ titulo: 'Emenda', criado_por_nome: null, data_documento: '2026-06-05' })).toBe('acordo_emenda_05-06-2026.pdf')
  })
})
