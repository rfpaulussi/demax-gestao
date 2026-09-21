import { describe, it, expect } from 'vitest'
import { CASOS, conferirCaso } from './casos'
import { lerExtracao } from './schema'

const base = lerExtracao({ situacao: null, perguntas: [] })!

describe('conferirCaso', () => {
  it('confere cada campo esperado', () => {
    const caso = CASOS.find(c => c.id === 's1-liberados-chuva')!
    const certo = { ...base, situacao: 'T2' as const, data_evento: '2026-09-14', hora_dispensa: '12:00', quantidade_dias: 6, todos_do_posto: true }
    expect(conferirCaso(caso, certo).ok).toBe(true)
    const errado = conferirCaso(caso, { ...certo, hora_dispensa: '13:00' })
    expect(errado.ok).toBe(false)
    expect(errado.campos.find(c => !c.ok)).toMatchObject({ campo: 'hora_dispensa', esperado: '12:00', obtido: '13:00' })
  })

  it('lista de datas precisa bater na ordem', () => {
    const caso = CASOS.find(c => c.id === 's6-dois-dias')!
    const obtido = { ...base, situacao: 'T5' as const, data_evento: '2026-06-20', datas_evento_extras: ['2026-06-21'], horas_trabalhadas: '04:00', data_folga: '2026-06-26', todos_do_posto: true }
    expect(conferirCaso(caso, obtido).ok).toBe(true)
    expect(conferirCaso(caso, { ...obtido, datas_evento_extras: [] }).ok).toBe(false)
  })

  it('pedido vago: acerta quando pergunta e erra quando preenche às cegas', () => {
    const vago = CASOS.find(c => c.id === 's9-vago')!
    expect(conferirCaso(vago, { ...base, perguntas: ['Por que folgam?'] }).ok).toBe(true)
    expect(conferirCaso(vago, base).ok).toBe(false)
  })

  it('casos de teste têm id único e pedido preenchido', () => {
    expect(new Set(CASOS.map(c => c.id)).size).toBe(CASOS.length)
    for (const c of CASOS) expect(c.pedido.length).toBeGreaterThan(10)
  })
})
