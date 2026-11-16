import { describe, expect, it } from 'vitest'
import { FORM_VAZIO, sincronizarDispensa } from './formulario'

describe('sincronizarDispensa', () => {
  it('T2 → T3: a data da dispensa vira o dia não trabalhado', () => {
    expect(sincronizarDispensa('T3', { ...FORM_VAZIO, dataEvento: '2026-10-30' })).toEqual({ dataFolga: '2026-10-30' })
  })

  it('T2 → T3: não sobrescreve um dia não trabalhado já preenchido', () => {
    expect(sincronizarDispensa('T3', { ...FORM_VAZIO, dataEvento: '2026-10-30', dataFolga: '2026-10-29' })).toEqual({})
  })

  it('T2 → T3: sem data nenhuma, nada a copiar', () => {
    expect(sincronizarDispensa('T3', FORM_VAZIO)).toEqual({})
  })

  it('T3 → T2: o dia não trabalhado vira o dia da dispensa', () => {
    expect(sincronizarDispensa('T2', { ...FORM_VAZIO, dataFolga: '2026-10-30' })).toEqual({ dataEvento: '2026-10-30' })
  })

  it('T3 → T2: não sobrescreve o dia da dispensa já preenchido', () => {
    expect(sincronizarDispensa('T2', { ...FORM_VAZIO, dataFolga: '2026-10-30', dataEvento: '2026-10-29' })).toEqual({})
  })

  it('T3 → T2 com revezamento: usa a data mais cedo e desliga o revezamento (T2 não tem)', () => {
    const f = { ...FORM_VAZIO, revezamento: true, folgas: { a: '2026-10-31', b: '2026-10-30' } }
    expect(sincronizarDispensa('T2', f)).toEqual({ dataEvento: '2026-10-30', revezamento: false, folgas: {} })
  })

  it('T3 → T2 com revezamento ainda sem datas: só desliga o revezamento', () => {
    expect(sincronizarDispensa('T2', { ...FORM_VAZIO, revezamento: true })).toEqual({ revezamento: false, folgas: {} })
  })
})
