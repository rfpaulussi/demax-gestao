import { describe, it, expect } from 'vitest'
import { buscarEnderecoPorCep } from './cep'

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })

const viaCepOk = { cep: '08725-740', logradouro: 'Avenida Antônio Vieira do Nascimento', bairro: 'Jardim Nathalie', localidade: 'Mogi das Cruzes', uf: 'SP' }
const brasilOk = { cep: '08725740', street: 'Avenida Antônio Vieira do Nascimento', neighborhood: 'Jardim Nathalie', city: 'Mogi das Cruzes', state: 'SP' }

/** fetch de mentira: responde por host e guarda quais foram chamados. */
function falso(respostas: Record<string, () => Response | Promise<Response>>) {
  const chamados: string[] = []
  const f = (async (url: string | URL | Request) => {
    const u = String(url)
    const host = new URL(u).host
    chamados.push(host)
    const r = respostas[host]
    if (!r) throw new Error('sem resposta para ' + host)
    return r()
  }) as typeof fetch
  return { f, chamados }
}

describe('buscarEnderecoPorCep', () => {
  it('acha pelo ViaCEP e nem chama a segunda fonte', async () => {
    const { f, chamados } = falso({ 'viacep.com.br': () => json(viaCepOk) })
    const r = await buscarEnderecoPorCep('08725-740', f)
    expect(r).toEqual({ ok: true, endereco: { logradouro: 'Avenida Antônio Vieira do Nascimento', bairro: 'Jardim Nathalie', cidade: 'Mogi das Cruzes', uf: 'SP' } })
    expect(chamados).toEqual(['viacep.com.br'])
  })

  it('ViaCEP fora do ar: usa a BrasilAPI', async () => {
    const { f, chamados } = falso({
      'viacep.com.br': () => { throw new Error('rede') },
      'brasilapi.com.br': () => json(brasilOk),
    })
    const r = await buscarEnderecoPorCep('08725740', f)
    expect(r.ok).toBe(true)
    expect(r.ok && r.endereco.bairro).toBe('Jardim Nathalie')
    expect(chamados).toEqual(['viacep.com.br', 'brasilapi.com.br'])
  })

  it('ViaCEP responde erro 500: usa a BrasilAPI', async () => {
    const { f } = falso({ 'viacep.com.br': () => json({}, 500), 'brasilapi.com.br': () => json(brasilOk) })
    expect((await buscarEnderecoPorCep('08725740', f)).ok).toBe(true)
  })

  it('ViaCEP diz que não existe, mas a BrasilAPI tem: devolve o endereço', async () => {
    const { f } = falso({ 'viacep.com.br': () => json({ erro: true }), 'brasilapi.com.br': () => json(brasilOk) })
    expect((await buscarEnderecoPorCep('08725740', f)).ok).toBe(true)
  })

  it('as duas dizem que não existe: nao_encontrado', async () => {
    const { f } = falso({ 'viacep.com.br': () => json({ erro: true }), 'brasilapi.com.br': () => json({ message: 'CEP NAO ENCONTRADO' }, 404) })
    expect(await buscarEnderecoPorCep('99999999', f)).toEqual({ ok: false, motivo: 'nao_encontrado' })
  })

  it('as duas fora do ar: indisponivel (não confunde com CEP inexistente)', async () => {
    const { f } = falso({ 'viacep.com.br': () => { throw new Error('rede') }, 'brasilapi.com.br': () => json({}, 503) })
    expect(await buscarEnderecoPorCep('08725740', f)).toEqual({ ok: false, motivo: 'indisponivel' })
  })

  it('CEP genérico (sem rua) volta ok com logradouro vazio', async () => {
    const { f } = falso({ 'viacep.com.br': () => json({ ...viaCepOk, logradouro: '', bairro: '' }) })
    const r = await buscarEnderecoPorCep('08700000', f)
    expect(r.ok && r.endereco.logradouro).toBe('')
    expect(r.ok && r.endereco.cidade).toBe('Mogi das Cruzes')
  })

  it('CEP com tamanho errado nem consulta', async () => {
    const { f, chamados } = falso({})
    expect(await buscarEnderecoPorCep('0872', f)).toEqual({ ok: false, motivo: 'invalido' })
    expect(chamados).toEqual([])
  })
})
