import { describe, it, expect, afterEach, vi } from 'vitest'
import { lerDestinatarios, destinosAmbulatorio } from './destinatarios'

afterEach(() => vi.unstubAllEnvs())

describe('destinosAmbulatorio', () => {
  it('em produção usa o ambulatório', () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('RESEND_TO_AMBULATORIO', 'rute@demax.com.br')
    expect(destinosAmbulatorio('quem@demax.com.br')).toEqual({ para: ['rute@demax.com.br'], teste: false })
  })

  it('em produção sem variável não envia para ninguém', () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('RESEND_TO_AMBULATORIO', '')
    expect(destinosAmbulatorio('quem@demax.com.br')).toEqual({ para: [], teste: false })
  })

  it('no preview manda só para quem está logado, mesmo com a variável definida', () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('RESEND_TO_AMBULATORIO', 'rute@demax.com.br')
    expect(destinosAmbulatorio('quem@demax.com.br')).toEqual({ para: ['quem@demax.com.br'], teste: true })
  })

  it('sem VERCEL_ENV (dev local) também é teste', () => {
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('RESEND_TO_AMBULATORIO', 'rute@demax.com.br')
    expect(destinosAmbulatorio('quem@demax.com.br').teste).toBe(true)
  })

  it('em teste sem e-mail do usuário não envia', () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    expect(destinosAmbulatorio(null).para).toEqual([])
  })
})

describe('lerDestinatarios', () => {
  it('lê um endereço', () => {
    expect(lerDestinatarios('rute@demax.com.br')).toEqual(['rute@demax.com.br'])
  })

  it('separa vários por vírgula e tira espaços', () => {
    expect(lerDestinatarios(' a@demax.com.br , b@demax.com.br ')).toEqual(['a@demax.com.br', 'b@demax.com.br'])
  })

  it('descarta valores inválidos', () => {
    expect(lerDestinatarios('sem-arroba, a@demax.com.br, @x.com, b@c')).toEqual(['a@demax.com.br'])
  })

  it('vazio ou ausente devolve lista vazia', () => {
    expect(lerDestinatarios('')).toEqual([])
    expect(lerDestinatarios(undefined)).toEqual([])
    expect(lerDestinatarios(null)).toEqual([])
  })
})
