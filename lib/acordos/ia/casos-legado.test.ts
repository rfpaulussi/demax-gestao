import { describe, it, expect } from 'vitest'
import { CASOS_LEGADO, conferirLegado } from './casos-legado'
import type { ClassificacaoLegado } from './legado'

const base: ClassificacaoLegado = {
  situacao: null, direcao_texto: 'indefinida', trabalhou_a_mais: false, data_evento: null, data_folga: null,
  tem_campos_em_branco: false, confianca: 'alta', resumo: '',
}

describe('conferirLegado', () => {
  it('confere só os campos que o caso espera', () => {
    const caso = CASOS_LEGADO.find(c => c.titulo.startsWith('Eleição'))!
    const certo = { ...base, ...caso.esperado }
    expect(conferirLegado(caso, certo).ok).toBe(true)
    const errado = conferirLegado(caso, { ...certo, direcao_texto: 'reposicao' })
    expect(errado.ok).toBe(false)
    expect(errado.campos.find(c => !c.ok)).toMatchObject({ campo: 'direcao_texto', esperado: 'descanso', obtido: 'reposicao' })
  })

  it('cada caso tem id real (uuid) e ao menos um campo esperado', () => {
    for (const c of CASOS_LEGADO) {
      expect(c.id).toMatch(/^[0-9a-f-]{36}$/)
      expect(Object.keys(c.esperado).length).toBeGreaterThan(0)
    }
  })

  it('ids não se repetem', () => {
    expect(new Set(CASOS_LEGADO.map(c => c.id)).size).toBe(CASOS_LEGADO.length)
  })
})
