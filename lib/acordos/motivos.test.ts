import { describe, it, expect } from 'vitest'
import { MOTIVOS, NOMES_EVENTO_SUGERIDOS, conectorDoMotivo } from './motivos'

describe('catálogo de motivos', () => {
  it('ids únicos e campos preenchidos', () => {
    const ids = MOTIVOS.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const m of MOTIVOS) {
      expect(m.grupo && m.rotulo && m.texto).toBeTruthy()
      expect(['conforme', 'em razão de']).toContain(m.conector)
    }
  })

  it('grupos de calendário e determinação usam "conforme"; funcionamento, infraestrutura e outros usam "em razão de"', () => {
    const porGrupo = (g: string) => MOTIVOS.filter(m => m.grupo === g).map(m => m.conector)
    expect(new Set(porGrupo('Calendário'))).toEqual(new Set(['conforme']))
    expect(new Set(porGrupo('Determinação da unidade'))).toEqual(new Set(['conforme']))
    for (const g of ['Funcionamento da unidade', 'Infraestrutura', 'Outros']) {
      expect(new Set(porGrupo(g))).toEqual(new Set(['em razão de']))
    }
  })

  it('sugere nomes de evento', () => {
    expect(NOMES_EVENTO_SUGERIDOS).toContain('Festa Junina')
    expect(NOMES_EVENTO_SUGERIDOS).toHaveLength(12)
  })
})

describe('conectorDoMotivo', () => {
  it('motivo do catálogo de infraestrutura -> "em razão de"', () => {
    expect(conectorDoMotivo('falta de água')).toBe('em razão de')
    expect(conectorDoMotivo('Falta de Água.')).toBe('em razão de')
  })

  it('motivo do catálogo com complemento (startsWith) -> conector do catálogo', () => {
    expect(conectorDoMotivo('Decreto municipal nº 24.034/2025')).toBe('conforme')
    expect(conectorDoMotivo('obra ou reforma na unidade (bloco B)')).toBe('em razão de')
  })

  it('texto livre ou vazio -> "conforme"', () => {
    expect(conectorDoMotivo('algo digitado livre')).toBe('conforme')
    expect(conectorDoMotivo('')).toBe('conforme')
  })
})
