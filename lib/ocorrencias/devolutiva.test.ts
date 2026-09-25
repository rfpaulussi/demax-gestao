import { describe, it, expect } from 'vitest'
import {
  MAX_COMENTARIO,
  validarTexto,
  montarDestinatariosSupervisores,
  escapeHtml,
  assuntoDevolutiva,
  templateDevolutivaOcorrencia,
} from './devolutiva'

describe('validarTexto', () => {
  it('recusa texto vazio ou só com espaços', () => {
    expect(validarTexto('')).toEqual({ ok: false, error: 'Escreva uma mensagem' })
    expect(validarTexto('   \n  ')).toEqual({ ok: false, error: 'Escreva uma mensagem' })
  })

  it('devolve o texto sem espaços nas pontas', () => {
    expect(validarTexto('  oi  ')).toEqual({ ok: true, texto: 'oi' })
  })

  it('recusa texto acima do limite', () => {
    const r = validarTexto('a'.repeat(MAX_COMENTARIO + 1))
    expect(r.ok).toBe(false)
  })

  it('aceita texto exatamente no limite', () => {
    const r = validarTexto('a'.repeat(MAX_COMENTARIO))
    expect(r.ok).toBe(true)
  })
})

describe('montarDestinatariosSupervisores', () => {
  it('junta supervisores do posto e o da ocorrência sem repetir', () => {
    const r = montarDestinatariosSupervisores({
      supervisoresDoPosto: ['s1', 's2'],
      supervisorDaOcorrencia: 's2',
      autorId: 'rh',
    })
    expect(r.sort()).toEqual(['s1', 's2'])
  })

  it('inclui o supervisor da ocorrência mesmo fora da lista do posto', () => {
    const r = montarDestinatariosSupervisores({
      supervisoresDoPosto: ['s1'],
      supervisorDaOcorrencia: 's9',
      autorId: 'rh',
    })
    expect(r.sort()).toEqual(['s1', 's9'])
  })

  it('não avisa o próprio autor', () => {
    const r = montarDestinatariosSupervisores({
      supervisoresDoPosto: ['s1', 's2'],
      supervisorDaOcorrencia: null,
      autorId: 's1',
    })
    expect(r).toEqual(['s2'])
  })

  it('devolve lista vazia quando não há ninguém', () => {
    const r = montarDestinatariosSupervisores({
      supervisoresDoPosto: [],
      supervisorDaOcorrencia: null,
      autorId: 'rh',
    })
    expect(r).toEqual([])
  })
})

describe('escapeHtml', () => {
  it('escapa os caracteres perigosos', () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;')
  })
})

describe('assuntoDevolutiva', () => {
  it('cita o funcionário', () => {
    expect(assuntoDevolutiva('Maria')).toBe('Nova devolutiva no dossiê de Maria')
  })
})

describe('templateDevolutivaOcorrencia', () => {
  const base = { funcionarioNome: 'Maria Souza', funcionarioId: 'abc-123', parecer: false }

  it('leva o link direto pro dossiê do funcionário', () => {
    const html = templateDevolutivaOcorrencia(base)
    expect(html).toContain('https://demax-gestao.vercel.app/ocorrencias?f=abc-123')
  })

  it('avisa que o conteúdo não vai por e-mail (LGPD)', () => {
    const html = templateDevolutivaOcorrencia(base)
    expect(html).toContain('não é enviado por e-mail')
  })

  it('escapa o nome do funcionário', () => {
    const html = templateDevolutivaOcorrencia({ ...base, funcionarioNome: '<script>x</script>' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('muda a chamada quando é parecer de encerramento', () => {
    const msg = templateDevolutivaOcorrencia(base)
    const parecer = templateDevolutivaOcorrencia({ ...base, parecer: true })
    expect(msg).toContain('nova devolutiva')
    expect(parecer).toContain('encerrada com parecer')
    expect(parecer).not.toContain('nova devolutiva')
  })
})
