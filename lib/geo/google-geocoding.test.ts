import { describe, it, expect, vi } from 'vitest'
import { geocodificarEndereco, interpretarResposta, type RespostaBruta } from './google-geocoding'
import { hashEndereco, normalizarEndereco, limparEnderecoBusca } from './endereco'

function resultado(over: Partial<{ tipo: string; parcial: boolean; cidade: string; placeId: string; lat: number }> = {}) {
  return {
    formatted_address: 'Rua Teste, 100 - Centro, Mogi das Cruzes - SP, Brasil',
    place_id: over.placeId ?? 'PLACE_1',
    partial_match: over.parcial,
    address_components: [
      { long_name: over.cidade ?? 'Mogi das Cruzes', short_name: 'Mogi das Cruzes', types: ['administrative_area_level_2', 'political'] },
      { long_name: 'São Paulo', short_name: 'SP', types: ['administrative_area_level_1', 'political'] },
    ],
    geometry: { location: { lat: over.lat ?? -23.52, lng: -46.18 }, location_type: over.tipo ?? 'ROOFTOP' },
  }
}

describe('interpretarResposta', () => {
  it('resultado único, preciso, na cidade e sem partial_match é forte', () => {
    const r = interpretarResposta({ status: 'OK', results: [resultado()] })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.classe).toBe('forte')
      expect(r.candidatos[0]).toMatchObject({ placeId: 'PLACE_1', tipo: 'ROOFTOP', uf: 'SP', cidade: 'Mogi das Cruzes' })
    }
  })

  it('partial_match vira ambíguo', () => {
    const r = interpretarResposta({ status: 'OK', results: [resultado({ parcial: true })] })
    expect(r.ok && r.classe).toBe('ambiguo')
  })

  it('tipo aproximado (centro/aproximado) vira ambíguo', () => {
    expect(interpretarResposta({ status: 'OK', results: [resultado({ tipo: 'GEOMETRIC_CENTER' })] })).toMatchObject({ ok: true, classe: 'ambiguo' })
    expect(interpretarResposta({ status: 'OK', results: [resultado({ tipo: 'APPROXIMATE' })] })).toMatchObject({ ok: true, classe: 'ambiguo' })
  })

  it('cidade diferente da esperada vira ambíguo', () => {
    const r = interpretarResposta({ status: 'OK', results: [resultado({ cidade: 'Suzano' })] })
    expect(r.ok && r.classe).toBe('ambiguo')
  })

  it('vários resultados são sempre ambíguos e limitados a 5', () => {
    const results = Array.from({ length: 7 }, (_, i) => resultado({ placeId: `P${i}` }))
    const r = interpretarResposta({ status: 'OK', results })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.classe).toBe('ambiguo')
      expect(r.candidatos).toHaveLength(5)
    }
  })

  it('ignora resultado sem place_id ou com coordenada inválida', () => {
    const sujo: RespostaBruta = {
      status: 'OK',
      results: [
        { ...resultado(), place_id: undefined },
        { ...resultado({ placeId: 'X' }), geometry: { location: { lat: 999, lng: 0 }, location_type: 'ROOFTOP' } },
      ],
    }
    expect(interpretarResposta(sujo)).toMatchObject({ ok: false, motivo: 'nao_encontrado' })
  })

  it.each([
    ['ZERO_RESULTS', 'nao_encontrado'],
    ['OVER_QUERY_LIMIT', 'cota'],
    ['OVER_DAILY_LIMIT', 'cota'],
    ['REQUEST_DENIED', 'negado'],
    ['INVALID_REQUEST', 'invalido'],
    ['UNKNOWN_ERROR', 'indisponivel'],
  ])('status %s vira motivo %s', (status, motivo) => {
    expect(interpretarResposta({ status })).toMatchObject({ ok: false, motivo })
  })
})

describe('geocodificarEndereco', () => {
  const ok = { ok: true, json: async () => ({ status: 'OK', results: [resultado()] }) }

  it('sem chave configurada não chama o Google', async () => {
    const fetchImpl = vi.fn()
    const antes = process.env.GOOGLE_GEOCODING_API_KEY
    delete process.env.GOOGLE_GEOCODING_API_KEY
    try {
      const r = await geocodificarEndereco('Rua Teste, 100', { fetchImpl })
      expect(r).toMatchObject({ ok: false, motivo: 'sem_chave' })
      expect(fetchImpl).not.toHaveBeenCalled()
    } finally {
      if (antes !== undefined) process.env.GOOGLE_GEOCODING_API_KEY = antes
    }
  })

  it('endereço curto demais não chama o Google', async () => {
    const fetchImpl = vi.fn()
    expect(await geocodificarEndereco('ab', { chave: 'k', fetchImpl })).toMatchObject({ ok: false, motivo: 'invalido' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('monta a URL restrita ao município e ao Brasil', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok)
    const r = await geocodificarEndereco('Rua Teste, 100', { chave: 'CHAVE_TESTE', fetchImpl })
    expect(r.ok).toBe(true)
    const url = new URL(fetchImpl.mock.calls[0][0] as string)
    expect(url.searchParams.get('address')).toBe('Rua Teste, 100')
    expect(url.searchParams.get('components')).toBe('country:BR|administrative_area:SP|locality:Mogi das Cruzes')
    expect(url.searchParams.get('language')).toBe('pt-BR')
  })

  it('tenta de novo uma vez em erro de rede e depois sucede', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce(ok)
    expect((await geocodificarEndereco('Rua Teste, 100', { chave: 'k', fetchImpl })).ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('falha de rede duas vezes vira indisponível, sem vazar a chave', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('falhou https://x?key=SEGREDO'))
    const r = await geocodificarEndereco('Rua Teste, 100', { chave: 'SEGREDO', fetchImpl })
    expect(r).toMatchObject({ ok: false, motivo: 'indisponivel' })
    expect(JSON.stringify(r)).not.toContain('SEGREDO')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('UNKNOWN_ERROR é repetido uma vez; OVER_QUERY_LIMIT não', async () => {
    const desconhecido = { ok: true, json: async () => ({ status: 'UNKNOWN_ERROR' }) }
    const f1 = vi.fn().mockResolvedValueOnce(desconhecido).mockResolvedValueOnce(ok)
    expect((await geocodificarEndereco('Rua Teste, 100', { chave: 'k', fetchImpl: f1 })).ok).toBe(true)
    const cota = { ok: true, json: async () => ({ status: 'OVER_QUERY_LIMIT' }) }
    const f2 = vi.fn().mockResolvedValue(cota)
    expect(await geocodificarEndereco('Rua Teste, 100', { chave: 'k', fetchImpl: f2 })).toMatchObject({ ok: false, motivo: 'cota' })
    expect(f2).toHaveBeenCalledTimes(1)
  })
})

describe('endereço: normalização e hash', () => {
  it('ignora acento, caixa, pontuação e espaços repetidos', () => {
    expect(normalizarEndereco('  Av.  Antônio   Vieira, 123 – Centro ')).toBe('av antonio vieira 123 centro')
  })

  it('mesmo endereço escrito de formas parecidas gera o mesmo hash; endereço diferente, outro', () => {
    expect(hashEndereco('Rua Carlos Lacerda, 71')).toBe(hashEndereco('rua  carlos lacerda 71'))
    expect(hashEndereco('Rua Carlos Lacerda, 71')).not.toBe(hashEndereco('Rua Carlos Lacerda, 72'))
  })

  it('limparEnderecoBusca tira quebras de linha e limita o tamanho', () => {
    expect(limparEnderecoBusca('Rua A\n  100')).toBe('Rua A 100')
    expect(limparEnderecoBusca('x'.repeat(500))).toHaveLength(300)
  })
})
