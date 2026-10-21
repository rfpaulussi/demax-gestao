export interface EnderecoCep {
  logradouro: string
  bairro: string
  cidade: string
  uf: string
}

export type ResultadoCep =
  | { ok: true; endereco: EnderecoCep }
  | { ok: false; motivo: 'invalido' | 'nao_encontrado' | 'indisponivel' }

type Buscador = typeof fetch

const TEMPO_LIMITE_MS = 4000

/** `null` = o serviço não respondeu direito (fora do ar, lento, resposta estranha). */
type RespostaFonte = EnderecoCep | 'nao_encontrado' | null

async function viaCep(cep: string, buscar: Buscador): Promise<RespostaFonte> {
  try {
    const resp = await buscar(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(TEMPO_LIMITE_MS), cache: 'no-store' })
    if (!resp.ok) return null
    const j = (await resp.json()) as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
    if (j.erro) return 'nao_encontrado'
    return { logradouro: j.logradouro ?? '', bairro: j.bairro ?? '', cidade: j.localidade ?? '', uf: j.uf ?? '' }
  } catch {
    return null
  }
}

async function brasilApi(cep: string, buscar: Buscador): Promise<RespostaFonte> {
  try {
    const resp = await buscar(`https://brasilapi.com.br/api/cep/v1/${cep}`, { signal: AbortSignal.timeout(TEMPO_LIMITE_MS), cache: 'no-store' })
    if (resp.status === 404) return 'nao_encontrado'
    if (!resp.ok) return null
    const j = (await resp.json()) as { street?: string; neighborhood?: string; city?: string; state?: string }
    return { logradouro: j.street ?? '', bairro: j.neighborhood ?? '', cidade: j.city ?? '', uf: j.state ?? '' }
  } catch {
    return null
  }
}

/**
 * Endereço de um CEP. Tenta o ViaCEP e, se ele falhar ou não achar, a BrasilAPI — as duas bases são independentes,
 * então o que uma não tem a outra costuma ter. Só o CEP sai daqui (nenhum dado da pessoa).
 */
export async function buscarEnderecoPorCep(cepBruto: string, buscar: Buscador = fetch): Promise<ResultadoCep> {
  const cep = cepBruto.replace(/\D/g, '')
  if (cep.length !== 8) return { ok: false, motivo: 'invalido' }

  const primeira = await viaCep(cep, buscar)
  if (primeira && primeira !== 'nao_encontrado') return { ok: true, endereco: primeira }

  const segunda = await brasilApi(cep, buscar)
  if (segunda && segunda !== 'nao_encontrado') return { ok: true, endereco: segunda }

  // Se alguma das fontes respondeu "não existe", o CEP é inexistente; se nenhuma respondeu, é falha de serviço.
  return { ok: false, motivo: primeira === 'nao_encontrado' || segunda === 'nao_encontrado' ? 'nao_encontrado' : 'indisponivel' }
}
