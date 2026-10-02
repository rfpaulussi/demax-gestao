import { describe, it, expect } from 'vitest'
import { causaDoDesligamento, exigeAviso } from './comunicado'

describe('causaDoDesligamento', () => {
  it('voluntária vira pedido de demissão', () => {
    expect(causaDoDesligamento('voluntaria', 'pessoal', null)).toBe('pedido_demissao')
  })

  it('reprova de experiência e fim de experiência marcam a mesma caixa', () => {
    expect(causaDoDesligamento('reprova_experiencia', 'desempenho', null)).toBe('reprova_experiencia')
    expect(causaDoDesligamento('outros', 'fim_experiencia', null)).toBe('reprova_experiencia')
  })

  it('demissão por justa causa ignora o aviso', () => {
    expect(causaDoDesligamento('demissao', 'justa_causa', 'trabalhado')).toBe('com_justa_causa')
  })

  it('demissão sem justa causa depende do aviso', () => {
    expect(causaDoDesligamento('demissao', 'corte_custo', 'trabalhado')).toBe('sem_justa_causa_trabalhado')
    expect(causaDoDesligamento('demissao', 'corte_custo', 'indenizado')).toBe('sem_justa_causa_indenizado')
    expect(causaDoDesligamento('demissao', 'corte_custo', null)).toBeNull()
  })

  it('falecimento marca a caixa própria; outros e judicial ficam em branco', () => {
    expect(causaDoDesligamento('outros', 'falecimento', null)).toBe('falecimento')
    expect(causaDoDesligamento('outros', 'invalidez', null)).toBeNull()
    expect(causaDoDesligamento('judicial', 'acordo_mutuo', null)).toBeNull()
  })
})

describe('exigeAviso', () => {
  it('só para demissão que não seja justa causa', () => {
    expect(exigeAviso('demissao', 'corte_custo')).toBe(true)
    expect(exigeAviso('demissao', 'justa_causa')).toBe(false)
    expect(exigeAviso('voluntaria', 'pessoal')).toBe(false)
    expect(exigeAviso(null, null)).toBe(false)
  })
})
