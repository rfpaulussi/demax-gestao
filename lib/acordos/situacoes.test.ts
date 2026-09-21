import { describe, it, expect } from 'vitest'
import { GRUPO_TRABALHOU, SITUACOES } from './situacoes'
import { TEMPLATES } from './templates'
import type { TemplateId } from './tipos'

describe('SITUACOES', () => {
  const ids = Object.keys(TEMPLATES) as TemplateId[]

  it('tem uma situação para cada template', () => {
    expect(Object.keys(SITUACOES).sort()).toEqual([...ids].sort())
  })

  it('todas têm título, exemplo, tag e cor', () => {
    for (const id of ids) {
      const s = SITUACOES[id]
      expect(s.titulo.length).toBeGreaterThan(10)
      expect(s.exemplo.length).toBeGreaterThan(10)
      expect(s.tag).toContain('→')
      expect(['blue', 'amber', 'orange', 'indigo', 'green']).toContain(s.cor)
    }
  })

  it('cada template tem uma cor diferente', () => {
    expect(new Set(ids.map(id => SITUACOES[id].cor)).size).toBe(ids.length)
  })

  it('o grupo "trabalharam a mais" oferece T5 (folga) e T1 (horas), ambos com rótulo de opção', () => {
    expect(GRUPO_TRABALHOU.templates).toEqual(['T5', 'T1'])
    for (const id of GRUPO_TRABALHOU.templates) expect(SITUACOES[id].opcao).toBeTruthy()
  })
})
