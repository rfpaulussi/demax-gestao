// Cliente da Google Geocoding API. SOMENTE no servidor: a chave (GOOGLE_GEOCODING_API_KEY) nunca vai ao browser.
// Não importar em componente 'use client'.

import { CIDADE_PADRAO, UF_PADRAO, normalizarEndereco } from './endereco'

export type TipoLocalizacao = 'ROOFTOP' | 'RANGE_INTERPOLATED' | 'GEOMETRIC_CENTER' | 'APPROXIMATE'

export type CandidatoGoogle = {
  lat: number
  lng: number
  enderecoFormatado: string
  placeId: string
  tipo: TipoLocalizacao | string
  parcial: boolean
  cidade: string | null
  uf: string | null
}

export type MotivoFalha = 'nao_encontrado' | 'sem_chave' | 'cota' | 'negado' | 'invalido' | 'indisponivel'

export type ResultadoGeocoding =
  | { ok: true; classe: 'forte' | 'ambiguo'; candidatos: CandidatoGoogle[]; statusGoogle: 'OK' }
  | { ok: false; motivo: MotivoFalha; erro: string; statusGoogle?: string }

type ComponenteEndereco = { long_name: string; short_name: string; types: string[] }
type ResultadoBruto = {
  formatted_address?: string
  place_id?: string
  partial_match?: boolean
  address_components?: ComponenteEndereco[]
  geometry?: { location?: { lat?: number; lng?: number }; location_type?: string }
}
export type RespostaBruta = { status?: string; results?: ResultadoBruto[] }

const MSG: Record<MotivoFalha, string> = {
  nao_encontrado: 'O Google não encontrou este endereço. Confira rua, número e bairro, ou marque o ponto direto no mapa.',
  sem_chave: 'Geocodificação não configurada no servidor (falta a chave do Google). Avise o administrador.',
  cota: 'Limite de consultas do Google atingido por agora. Tente de novo mais tarde ou marque o ponto no mapa.',
  negado: 'O Google recusou a consulta (chave ou restrição inválida). Avise o administrador.',
  invalido: 'Endereço inválido para consulta. Informe ao menos a rua e o número.',
  indisponivel: 'Não foi possível consultar o Google agora. Tente de novo ou marque o ponto no mapa.',
}

const TIPOS_PRECISOS = new Set(['ROOFTOP', 'RANGE_INTERPOLATED'])

function componente(r: ResultadoBruto, tipo: string): string | null {
  return r.address_components?.find(c => c.types.includes(tipo))?.long_name ?? null
}

/** Converte a resposta bruta do Google em candidatos e decide se há um resultado forte ou se é ambíguo. Função pura. */
export function interpretarResposta(
  resp: RespostaBruta,
  cidadeEsperada: string = CIDADE_PADRAO,
): ResultadoGeocoding {
  const status = resp.status ?? 'UNKNOWN_ERROR'
  if (status === 'ZERO_RESULTS') return { ok: false, motivo: 'nao_encontrado', erro: MSG.nao_encontrado, statusGoogle: status }
  if (status === 'OVER_QUERY_LIMIT' || status === 'OVER_DAILY_LIMIT') return { ok: false, motivo: 'cota', erro: MSG.cota, statusGoogle: status }
  if (status === 'REQUEST_DENIED') return { ok: false, motivo: 'negado', erro: MSG.negado, statusGoogle: status }
  if (status === 'INVALID_REQUEST') return { ok: false, motivo: 'invalido', erro: MSG.invalido, statusGoogle: status }
  if (status !== 'OK') return { ok: false, motivo: 'indisponivel', erro: MSG.indisponivel, statusGoogle: status }

  const candidatos: CandidatoGoogle[] = []
  for (const r of resp.results ?? []) {
    const lat = r.geometry?.location?.lat
    const lng = r.geometry?.location?.lng
    if (typeof lat !== 'number' || typeof lng !== 'number' || !r.place_id) continue
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue
    candidatos.push({
      lat,
      lng,
      enderecoFormatado: r.formatted_address ?? '',
      placeId: r.place_id,
      tipo: r.geometry?.location_type ?? 'APPROXIMATE',
      parcial: r.partial_match === true,
      cidade: componente(r, 'administrative_area_level_2') ?? componente(r, 'locality'),
      uf: r.address_components?.find(c => c.types.includes('administrative_area_level_1'))?.short_name ?? null,
    })
  }
  if (candidatos.length === 0) return { ok: false, motivo: 'nao_encontrado', erro: MSG.nao_encontrado, statusGoogle: status }

  const lista = candidatos.slice(0, 5)
  const unico = lista.length === 1 ? lista[0] : null
  const naCidade = unico?.cidade != null && normalizarEndereco(unico.cidade) === normalizarEndereco(cidadeEsperada)
  const forte = !!unico && TIPOS_PRECISOS.has(unico.tipo) && !unico.parcial && naCidade
  return { ok: true, classe: forte ? 'forte' : 'ambiguo', candidatos: lista, statusGoogle: 'OK' }
}

type FetchLike = (url: string, init: { signal: AbortSignal; cache: 'no-store' }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>

/**
 * Consulta o Google para um endereço de posto. Restringe a busca ao município do contrato.
 * A URL leva a chave: nunca é logada nem devolvida; erros viram mensagens genéricas.
 */
export async function geocodificarEndereco(
  endereco: string,
  opts: { chave?: string; cidade?: string; uf?: string; fetchImpl?: FetchLike } = {},
): Promise<ResultadoGeocoding> {
  const chave = opts.chave ?? process.env.GOOGLE_GEOCODING_API_KEY
  if (!chave) return { ok: false, motivo: 'sem_chave', erro: MSG.sem_chave }
  const texto = endereco.trim()
  if (texto.length < 5) return { ok: false, motivo: 'invalido', erro: MSG.invalido }

  const cidade = opts.cidade ?? CIDADE_PADRAO
  const uf = opts.uf ?? UF_PADRAO
  const params = new URLSearchParams({
    address: texto,
    components: `country:BR|administrative_area:${uf}|locality:${cidade}`,
    language: 'pt-BR',
    region: 'br',
    key: chave,
  })
  const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
  const buscar = opts.fetchImpl ?? ((u, init) => fetch(u, init))

  // Uma nova tentativa só para erro transitório (rede/tempo limite ou UNKNOWN_ERROR).
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const res = await buscar(url, { signal: AbortSignal.timeout(8000), cache: 'no-store' })
      if (!res.ok) {
        if (tentativa === 0) continue
        return { ok: false, motivo: 'indisponivel', erro: MSG.indisponivel }
      }
      const r = interpretarResposta((await res.json()) as RespostaBruta, cidade)
      if (!r.ok && r.statusGoogle === 'UNKNOWN_ERROR' && tentativa === 0) continue
      return r
    } catch {
      if (tentativa === 1) return { ok: false, motivo: 'indisponivel', erro: MSG.indisponivel }
    }
  }
  return { ok: false, motivo: 'indisponivel', erro: MSG.indisponivel }
}
