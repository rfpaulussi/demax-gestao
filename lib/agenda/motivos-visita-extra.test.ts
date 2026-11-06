import { describe, it, expect } from 'vitest'
import { TIPOS_MOTIVO_EXTRA, ROTULO_MOTIVO_EXTRA, exigeTextoMotivoExtra } from './motivos-visita-extra'

describe('motivos da visita extra', () => {
  it('só "outro" exige texto', () => {
    expect(exigeTextoMotivoExtra('outro')).toBe(true)
    expect(exigeTextoMotivoExtra('reposicao')).toBe(false)
    expect(exigeTextoMotivoExtra('emergencia')).toBe(false)
    expect(exigeTextoMotivoExtra('direcao')).toBe(false)
    expect(exigeTextoMotivoExtra('cobertura')).toBe(false)
    expect(exigeTextoMotivoExtra('inexistente')).toBe(false)
  })

  it('tem rótulo pra cada motivo', () => {
    for (const m of TIPOS_MOTIVO_EXTRA) expect(ROTULO_MOTIVO_EXTRA[m.id]).toBe(m.rotulo)
  })
})
