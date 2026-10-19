import { describe, it, expect } from 'vitest'
import { calcularAguardando } from './aguardando'

const CRIADA = '2026-09-17T10:00:00Z'

describe('calcularAguardando', () => {
  it('sem mensagem: aguardando a gestão desde o registro', () => {
    expect(calcularAguardando({ ultimaMensagem: null, ocorrenciaCriadaEm: CRIADA, cienciaGestaoEm: null }))
      .toEqual({ lado: 'gestao', desde: CRIADA })
  })

  it('última mensagem do supervisor: aguardando a gestão', () => {
    const r = calcularAguardando({
      ultimaMensagem: { autorRole: 'supervisor', criadaEm: '2026-10-01T17:22:00Z' },
      ocorrenciaCriadaEm: CRIADA,
      cienciaGestaoEm: null,
    })
    expect(r).toEqual({ lado: 'gestao', desde: '2026-10-01T17:22:00Z' })
  })

  it('última mensagem da gestão: aguardando o supervisor', () => {
    const r = calcularAguardando({
      ultimaMensagem: { autorRole: 'admin', criadaEm: '2026-10-19T10:49:00Z' },
      ocorrenciaCriadaEm: CRIADA,
      cienciaGestaoEm: null,
    })
    expect(r).toEqual({ lado: 'supervisor', desde: '2026-10-19T10:49:00Z' })
  })

  it('ciente posterior à espera tira a pendência da gestão', () => {
    expect(calcularAguardando({ ultimaMensagem: null, ocorrenciaCriadaEm: CRIADA, cienciaGestaoEm: '2026-10-19T12:00:00Z' }))
      .toBeNull()
  })

  it('supervisor escreve depois do ciente: volta a pendente', () => {
    const r = calcularAguardando({
      ultimaMensagem: { autorRole: 'supervisor', criadaEm: '2026-10-20T08:00:00Z' },
      ocorrenciaCriadaEm: CRIADA,
      cienciaGestaoEm: '2026-10-19T12:00:00Z',
    })
    expect(r).toEqual({ lado: 'gestao', desde: '2026-10-20T08:00:00Z' })
  })

  it('ciente não esconde a espera do supervisor', () => {
    const r = calcularAguardando({
      ultimaMensagem: { autorRole: 'admin', criadaEm: '2026-10-19T10:49:00Z' },
      ocorrenciaCriadaEm: CRIADA,
      cienciaGestaoEm: '2026-10-19T12:00:00Z',
    })
    expect(r).toEqual({ lado: 'supervisor', desde: '2026-10-19T10:49:00Z' })
  })
})
