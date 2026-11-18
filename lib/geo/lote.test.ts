import { describe, it, expect } from 'vitest'
import { enderecoDoPosto, selecionarPendentes } from './lote'
import { hashEndereco } from './endereco'

const base = { endereco_busca: null, endereco_ref: null, geo_status: 'sem_coordenada', geo_endereco_hash: null, geo_google_lat: null, geo_google_expira_em: null }
const futuro = new Date(Date.now() + 5 * 86_400_000).toISOString()
const passado = new Date(Date.now() - 5 * 86_400_000).toISOString()

describe('selecionarPendentes', () => {
  it('usa endereco_busca e, na falta, endereco_ref', () => {
    expect(enderecoDoPosto({ endereco_busca: 'Rua A, 1', endereco_ref: 'Rua B, 2' })).toBe('Rua A, 1')
    expect(enderecoDoPosto({ endereco_busca: null, endereco_ref: 'Rua B, 2' })).toBe('Rua B, 2')
    expect(enderecoDoPosto({ endereco_busca: null, endereco_ref: null })).toBe('')
  })

  it('sem endereço não entra na fila e é contado', () => {
    const r = selecionarPendentes([{ ...base, id: '1', nome: 'A' }, { ...base, id: '2', nome: 'B', endereco_ref: 'ab' }])
    expect(r.ids).toHaveLength(0)
    expect(r.semEndereco).toBe(2)
  })

  it('com endereço e sem sugestão entra na fila', () => {
    const r = selecionarPendentes([{ ...base, id: '1', nome: 'A', endereco_ref: 'Rua Teste, 100' }])
    expect(r.ids).toEqual([{ id: '1', nome: 'A' }])
  })

  it('sugestão vigente não é consultada de novo; vencida volta para a fila', () => {
    const vigente = { ...base, id: '1', nome: 'A', endereco_busca: 'Rua A, 1', geo_google_lat: -23.5, geo_google_expira_em: futuro }
    const vencida = { ...base, id: '2', nome: 'B', endereco_busca: 'Rua B, 2', geo_google_lat: -23.5, geo_google_expira_em: passado }
    const r = selecionarPendentes([vigente, vencida])
    expect(r.ids.map(i => i.id)).toEqual(['2'])
    expect(r.jaConsultados).toBe(1)
  })

  it('"não encontrado" com o mesmo endereço não é repetido; com endereço alterado volta', () => {
    const igual = { ...base, id: '1', nome: 'A', endereco_busca: 'Rua A, 1', geo_status: 'nao_encontrado', geo_endereco_hash: hashEndereco('Rua A, 1') }
    const mudou = { ...base, id: '2', nome: 'B', endereco_busca: 'Rua B, 2', geo_status: 'nao_encontrado', geo_endereco_hash: hashEndereco('Rua antiga, 9') }
    const r = selecionarPendentes([igual, mudou])
    expect(r.ids.map(i => i.id)).toEqual(['2'])
  })
})
