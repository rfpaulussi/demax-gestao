import { describe, it, expect } from 'vitest'
import { explicacaoDe } from './explicar'

describe('explicacaoDe', () => {
  it('diz de quem é a regra: lei, sistema ou cadastro', () => {
    expect(explicacaoDe('LIMITE_JORNADA')?.origem).toBe('lei')
    expect(explicacaoDe('DIVISAO')?.origem).toBe('sistema')
    expect(explicacaoDe('TURNO_FORA_44H')?.origem).toBe('cadastro')
  })

  it('os bloqueios de dias oferecem o botão de recalcular', () => {
    for (const c of ['LIMITE_JORNADA', 'LIMITE_ACRESCIMO', 'DIVISAO']) expect(explicacaoDe(c)?.acao).toBe('recalcular_dias')
    expect(explicacaoDe('PRAZO_LONGO')?.acao).toBeUndefined()
  })

  it('código desconhecido não tem explicação', () => {
    expect(explicacaoDe('XYZ')).toBeNull()
  })
})
