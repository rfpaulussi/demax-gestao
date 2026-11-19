import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cronAutorizado } from './autorizado'

// Credenciais simuladas: nenhum segredo real, nenhuma rota executada.
const SEGREDO = 'segredo-simulado-de-teste'

describe('cronAutorizado', () => {
  it('aceita o cabeçalho correto', () => {
    expect(cronAutorizado(`Bearer ${SEGREDO}`, SEGREDO)).toBe(true)
  })

  it('rejeita cabeçalho incorreto', () => {
    expect(cronAutorizado('Bearer outro-valor', SEGREDO)).toBe(false)
    expect(cronAutorizado(`bearer ${SEGREDO}`, SEGREDO)).toBe(false)
    expect(cronAutorizado(SEGREDO, SEGREDO)).toBe(false)
    expect(cronAutorizado(`Bearer ${SEGREDO} `, SEGREDO)).toBe(false)
  })

  it('rejeita cabeçalho ausente', () => {
    expect(cronAutorizado(null, SEGREDO)).toBe(false)
    expect(cronAutorizado(undefined, SEGREDO)).toBe(false)
    expect(cronAutorizado('', SEGREDO)).toBe(false)
  })

  it('falha fechada com segredo ausente: "Bearer undefined" NÃO passa (falha original dos Previews)', () => {
    expect(cronAutorizado('Bearer undefined', undefined)).toBe(false)
    expect(cronAutorizado('Bearer ', undefined)).toBe(false)
    expect(cronAutorizado(null, undefined)).toBe(false)
  })

  it('falha fechada com segredo vazio ou só espaços', () => {
    expect(cronAutorizado('Bearer ', '')).toBe(false)
    expect(cronAutorizado('Bearer', '')).toBe(false)
    expect(cronAutorizado('Bearer    ', '   ')).toBe(false)
    expect(cronAutorizado('Bearer null', '')).toBe(false)
  })

  it('lê process.env.CRON_SECRET por padrão', () => {
    const original = process.env.CRON_SECRET
    try {
      delete process.env.CRON_SECRET
      expect(cronAutorizado('Bearer undefined')).toBe(false)
      process.env.CRON_SECRET = SEGREDO
      expect(cronAutorizado(`Bearer ${SEGREDO}`)).toBe(true)
      expect(cronAutorizado('Bearer undefined')).toBe(false)
    } finally {
      if (original === undefined) delete process.env.CRON_SECRET
      else process.env.CRON_SECRET = original
    }
  })
})

// Guarda de regressão estática: apenas LÊ o texto dos arquivos, não importa nem executa as rotas.
describe('rotas de cron usam a validação segura', () => {
  const rotas = ['snapshot-diario', 'limpar-fotos-agenda', 'limpar-geo-google']
  for (const rota of rotas) {
    const fonte = readFileSync(path.resolve('app/api/cron', rota, 'route.ts'), 'utf8')
    it(`${rota}: usa cronAutorizado e não compara direto com process.env.CRON_SECRET`, () => {
      expect(fonte).toContain("from '@/lib/cron/autorizado'")
      expect(fonte).toContain('!cronAutorizado(req.headers.get(')
      expect(fonte).not.toMatch(/!==\s*`Bearer \$\{process\.env\.CRON_SECRET\}`/)
    })
  }
})
