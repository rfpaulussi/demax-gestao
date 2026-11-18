import { describe, it, expect, vi, beforeEach } from 'vitest'

const geocodificar = vi.fn()
vi.mock('./google-geocoding', () => ({ geocodificarEndereco: (...a: unknown[]) => geocodificar(...a) }))

import { geocodificarPostoCore } from './geocodificar-posto'
import { hashEndereco } from './endereco'

type Linha = Record<string, unknown>

function fakeDb(posto: Linha | null) {
  const updates: Linha[] = []
  const historico: Linha[] = []
  const db = {
    from(tabela: string) {
      if (tabela === 'postos_geo_historico') return { insert: async (r: Linha) => { historico.push(r); return { error: null } } }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: posto, error: null }) }) }),
        update: (u: Linha) => { updates.push(u); return { eq: async () => ({ error: null }) } },
      }
    },
  }
  return { db, updates, historico }
}

const postoBase = {
  id: 'p1', latitude: null, longitude: null, geo_status: 'sem_coordenada', endereco_busca: null,
  geo_endereco_hash: null, geo_place_id: null, geo_google_lat: null, geo_google_lng: null,
  geo_google_endereco: null, geo_google_tipo: null, geo_google_parcial: null, geo_google_expira_em: null,
}

const candidato = { lat: -23.52, lng: -46.18, enderecoFormatado: 'Rua A, 10', placeId: 'PID', tipo: 'ROOFTOP', parcial: false, cidade: 'Mogi das Cruzes', uf: 'SP' }
const forte = { ok: true, classe: 'forte', candidatos: [candidato], statusGoogle: 'OK' }

beforeEach(() => geocodificar.mockReset())

describe('geocodificarPostoCore', () => {
  it('sem endereço não chama o Google', async () => {
    const { db } = fakeDb({ ...postoBase })
    const r = await geocodificarPostoCore(db, 'p1', { usuarioId: 'u1' })
    expect(r).toMatchObject({ ok: false, motivo: 'sem_endereco' })
    expect(geocodificar).not.toHaveBeenCalled()
  })

  it('resultado forte grava só nas colunas do Google, nunca em latitude/longitude, e registra histórico', async () => {
    geocodificar.mockResolvedValue(forte)
    const { db, updates, historico } = fakeDb({ ...postoBase })
    const r = await geocodificarPostoCore(db, 'p1', { usuarioId: 'u1', endereco: 'Rua A, 10' })
    expect(r).toMatchObject({ ok: true, fonte: 'google', classe: 'forte' })
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({ geo_place_id: 'PID', geo_google_lat: -23.52, geo_endereco_hash: hashEndereco('Rua A, 10') })
    expect(updates[0]).not.toHaveProperty('latitude')
    expect(updates[0]).not.toHaveProperty('longitude')
    expect(updates[0].geo_google_expira_em).toBeTruthy()
    expect(historico[0]).toMatchObject({ evento: 'geocodificado', place_id: 'PID', executado_por: 'u1', latitude: null })
  })

  it('mesmo endereço com sugestão vigente reaproveita o cache e não chama o Google', async () => {
    const expira = new Date(Date.now() + 10 * 86_400_000).toISOString()
    const { db } = fakeDb({
      ...postoBase, endereco_busca: 'Rua A, 10', geo_endereco_hash: hashEndereco('Rua A, 10'),
      geo_place_id: 'PID', geo_google_lat: -23.52, geo_google_lng: -46.18, geo_google_expira_em: expira,
    })
    const r = await geocodificarPostoCore(db, 'p1', { usuarioId: 'u1', endereco: 'rua a  10' })
    expect(r).toMatchObject({ ok: true, fonte: 'cache' })
    expect(geocodificar).not.toHaveBeenCalled()
  })

  it('"revalidar" (forcar) chama o Google mesmo com cache vigente', async () => {
    geocodificar.mockResolvedValue(forte)
    const expira = new Date(Date.now() + 10 * 86_400_000).toISOString()
    const { db } = fakeDb({
      ...postoBase, endereco_busca: 'Rua A, 10', geo_endereco_hash: hashEndereco('Rua A, 10'),
      geo_place_id: 'PID', geo_google_lat: -23.52, geo_google_lng: -46.18, geo_google_expira_em: expira,
    })
    await geocodificarPostoCore(db, 'p1', { usuarioId: 'u1', forcar: true })
    expect(geocodificar).toHaveBeenCalledTimes(1)
  })

  it('endereço que já deu "não encontrado" não é consultado de novo sem revalidar', async () => {
    const { db } = fakeDb({ ...postoBase, endereco_busca: 'Rua X, 1', geo_endereco_hash: hashEndereco('Rua X, 1'), geo_status: 'nao_encontrado' })
    const r = await geocodificarPostoCore(db, 'p1', { usuarioId: 'u1' })
    expect(r).toMatchObject({ ok: false, motivo: 'nao_encontrado_cache' })
    expect(geocodificar).not.toHaveBeenCalled()
  })

  it('endereço alterado consulta o Google de novo', async () => {
    geocodificar.mockResolvedValue(forte)
    const { db } = fakeDb({ ...postoBase, endereco_busca: 'Rua A, 10', geo_endereco_hash: hashEndereco('Rua A, 10') })
    await geocodificarPostoCore(db, 'p1', { usuarioId: 'u1', endereco: 'Rua B, 20' })
    expect(geocodificar).toHaveBeenCalledTimes(1)
  })

  it('posto com ponto oficial: falha do Google não muda o status do ponto nem apaga coordenadas', async () => {
    geocodificar.mockResolvedValue({ ok: false, motivo: 'indisponivel', erro: 'fora do ar', statusGoogle: 'UNKNOWN_ERROR' })
    const { db, updates } = fakeDb({ ...postoBase, latitude: -23.5, longitude: -46.1, geo_status: 'confirmado' })
    const r = await geocodificarPostoCore(db, 'p1', { usuarioId: 'u1', endereco: 'Rua A, 10' })
    expect(r).toMatchObject({ ok: false, motivo: 'indisponivel' })
    expect(updates[0]).not.toHaveProperty('geo_status')
    expect(updates[0]).not.toHaveProperty('latitude')
  })

  it('posto sem ponto: falha vira status erro e o texto digitado é guardado', async () => {
    geocodificar.mockResolvedValue({ ok: false, motivo: 'cota', erro: 'limite', statusGoogle: 'OVER_QUERY_LIMIT' })
    const { db, updates } = fakeDb({ ...postoBase })
    await geocodificarPostoCore(db, 'p1', { usuarioId: 'u1', endereco: 'Rua A, 10' })
    expect(updates[0]).toMatchObject({ endereco_busca: 'Rua A, 10', geo_status: 'erro' })
    expect(updates[0]).not.toHaveProperty('geo_endereco_hash')
  })

  it('ambíguo não grava sugestão nem hash; devolve candidatos para a coordenação escolher', async () => {
    geocodificar.mockResolvedValue({ ok: true, classe: 'ambiguo', candidatos: [candidato, { ...candidato, placeId: 'P2' }], statusGoogle: 'OK' })
    const { db, updates } = fakeDb({ ...postoBase })
    const r = await geocodificarPostoCore(db, 'p1', { usuarioId: 'u1', endereco: 'Rua A' + ' 10' })
    expect(r).toMatchObject({ ok: true, classe: 'ambiguo', escolhido: null })
    if (r.ok) expect(r.candidatos).toHaveLength(2)
    expect(updates[0]).toMatchObject({ geo_status: 'ambiguo' })
    expect(updates[0]).not.toHaveProperty('geo_google_lat')
    expect(updates[0]).not.toHaveProperty('geo_endereco_hash')
  })

  it('sugestão a mais de 300 m do ponto oficial é marcada como divergente', async () => {
    geocodificar.mockResolvedValue(forte)
    const { db } = fakeDb({ ...postoBase, latitude: -23.53, longitude: -46.18, geo_status: 'confirmado' }) // ~1,1 km
    const r = await geocodificarPostoCore(db, 'p1', { usuarioId: 'u1', endereco: 'Rua A, 10' })
    expect(r).toMatchObject({ ok: true, divergente: true })
  })
})
