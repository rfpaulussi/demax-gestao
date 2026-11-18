// Núcleo da geocodificação de um posto. Servidor apenas; quem chama (Server Action) já checou a permissão.
//
// Regras (termos da Geocoding API do Google, itens 6.2 e 6.3):
//  - o resultado do Google vai para colunas próprias (geo_google_*), com validade de 30 dias;
//  - NUNCA grava em postos.latitude/longitude: o ponto oficial é do GPS do supervisor ou da marcação da coordenação;
//  - o place_id fica sem prazo;
//  - o mesmo endereço não é consultado de novo (hash em geo_endereco_hash), salvo "revalidar" manual.

import { distanciaM } from '@/lib/agenda/geo'
import { geocodificarEndereco, type CandidatoGoogle, type MotivoFalha } from './google-geocoding'
import { hashEndereco, limparEnderecoBusca } from './endereco'
import { registrarHistoricoGeo, type AnyClient } from './historico'

export const VALIDADE_GOOGLE_DIAS = 30
export const DIVERGENCIA_M = 300 // sugestão do Google a mais que isso do ponto oficial = conferir

const MSG_MIGRACAO = 'Recurso indisponível: aplique a migração 20261118_postos_geocodificacao.sql no Supabase Studio.'

export type CandidatoView = CandidatoGoogle & {
  distanciaPinoM: number | null // distância até o ponto oficial atual (null se o posto ainda não tem ponto)
  linkGoogle: string // abre o Google Maps (mapa do próprio Google) para conferir a sugestão
}

export type SaidaGeocodificacao =
  | { ok: true; fonte: 'cache' | 'google'; classe: 'forte' | 'ambiguo'; candidatos: CandidatoView[]; escolhido: CandidatoView | null; divergente: boolean }
  | { ok: false; motivo: MotivoFalha | 'sem_endereco' | 'migracao' | 'nao_encontrado_cache' | 'posto'; erro: string }

type PostoGeo = {
  id: string
  latitude: number | null
  longitude: number | null
  geo_status: string | null
  endereco_busca: string | null
  geo_endereco_hash: string | null
  geo_place_id: string | null
  geo_google_lat: number | null
  geo_google_lng: number | null
  geo_google_endereco: string | null
  geo_google_tipo: string | null
  geo_google_parcial: boolean | null
  geo_google_expira_em: string | null
}

const COLUNAS =
  'id, latitude, longitude, geo_status, endereco_busca, geo_endereco_hash, geo_place_id, geo_google_lat, geo_google_lng, geo_google_endereco, geo_google_tipo, geo_google_parcial, geo_google_expira_em'

function linkGoogle(c: Pick<CandidatoGoogle, 'lat' | 'lng' | 'placeId'>): string {
  const q = new URLSearchParams({ api: '1', query: `${c.lat},${c.lng}`, query_place_id: c.placeId })
  return `https://www.google.com/maps/search/?${q.toString()}`
}

function comDistancia(c: CandidatoGoogle, posto: Pick<PostoGeo, 'latitude' | 'longitude'>): CandidatoView {
  const d = posto.latitude != null && posto.longitude != null ? distanciaM(c.lat, c.lng, posto.latitude, posto.longitude) : null
  return { ...c, distanciaPinoM: d == null ? null : Math.round(d), linkGoogle: linkGoogle(c) }
}

/** O status do posto descreve o ponto oficial: com ponto já gravado, o resultado do Google não o altera. */
function statusSeSemPonto(posto: Pick<PostoGeo, 'latitude' | 'longitude'>, status: string): { geo_status?: string } {
  return posto.latitude != null && posto.longitude != null ? {} : { geo_status: status }
}

function camposCandidato(c: CandidatoGoogle, agora: number) {
  return {
    geo_place_id: c.placeId,
    geo_google_lat: c.lat,
    geo_google_lng: c.lng,
    geo_google_endereco: c.enderecoFormatado.slice(0, 300) || null,
    geo_google_tipo: String(c.tipo),
    geo_google_parcial: c.parcial,
    geo_google_em: new Date(agora).toISOString(),
    geo_google_expira_em: new Date(agora + VALIDADE_GOOGLE_DIAS * 86_400_000).toISOString(),
  }
}

/** Grava o candidato escolhido (forte ou escolhido pela coordenação) nas colunas do Google. */
export async function persistirCandidato(
  db: AnyClient,
  posto: Pick<PostoGeo, 'id' | 'latitude' | 'longitude'>,
  candidato: CandidatoGoogle,
  enderecoBusca: string,
  usuarioId: string,
  detalhe: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { error } = await db
    .from('postos')
    .update({
      endereco_busca: enderecoBusca,
      geo_endereco_hash: hashEndereco(enderecoBusca),
      ...camposCandidato(candidato, Date.now()),
      ...statusSeSemPonto(posto, 'sem_coordenada'),
    })
    .eq('id', posto.id)
  if (error) return { ok: false, erro: 'Não foi possível salvar o resultado da geocodificação.' }
  await registrarHistoricoGeo(db, {
    postoId: posto.id, evento: 'geocodificado', executadoPor: usuarioId, statusGeo: 'OK',
    placeId: candidato.placeId, enderecoBusca, detalhe,
  })
  return { ok: true }
}

export async function geocodificarPostoCore(
  db: AnyClient,
  postoId: string,
  opts: { usuarioId: string; endereco?: string; forcar?: boolean },
): Promise<SaidaGeocodificacao> {
  const { data, error } = await db.from('postos').select(COLUNAS).eq('id', postoId).maybeSingle()
  if (error) return { ok: false, motivo: 'migracao', erro: MSG_MIGRACAO }
  const posto = data as PostoGeo | null
  if (!posto) return { ok: false, motivo: 'posto', erro: 'Posto não encontrado.' }

  const endereco = limparEnderecoBusca(opts.endereco !== undefined ? opts.endereco : posto.endereco_busca ?? '')
  if (endereco.length < 5) return { ok: false, motivo: 'sem_endereco', erro: 'Informe o endereço do posto (rua, número, bairro) para consultar.' }
  const hash = hashEndereco(endereco)
  const agora = Date.now()

  // Mesmo endereço já resolvido: reaproveita o que está no banco, sem chamar o Google.
  if (!opts.forcar && hash === posto.geo_endereco_hash) {
    const vigente = posto.geo_google_lat != null && posto.geo_google_lng != null && !!posto.geo_google_expira_em && Date.parse(posto.geo_google_expira_em) > agora
    if (vigente && posto.geo_place_id) {
      const escolhido = comDistancia({
        lat: posto.geo_google_lat as number, lng: posto.geo_google_lng as number,
        enderecoFormatado: posto.geo_google_endereco ?? '', placeId: posto.geo_place_id,
        tipo: posto.geo_google_tipo ?? 'APPROXIMATE', parcial: posto.geo_google_parcial === true, cidade: null, uf: null,
      }, posto)
      return { ok: true, fonte: 'cache', classe: 'forte', candidatos: [escolhido], escolhido, divergente: escolhido.distanciaPinoM != null && escolhido.distanciaPinoM > DIVERGENCIA_M }
    }
    if (posto.geo_status === 'nao_encontrado') {
      return { ok: false, motivo: 'nao_encontrado_cache', erro: 'Este endereço já foi consultado e o Google não o encontrou. Corrija o texto do endereço ou use "Revalidar".' }
    }
  }

  const r = await geocodificarEndereco(endereco)

  if (!r.ok) {
    const base = { endereco_busca: endereco }
    const upd = r.motivo === 'nao_encontrado'
      ? { ...base, geo_endereco_hash: hash, geo_google_lat: null, geo_google_lng: null, geo_google_expira_em: null, ...statusSeSemPonto(posto, 'nao_encontrado') }
      : { ...base, ...statusSeSemPonto(posto, 'erro') }
    await db.from('postos').update(upd).eq('id', posto.id)
    await registrarHistoricoGeo(db, {
      postoId: posto.id, evento: 'geocodificacao_falhou', executadoPor: opts.usuarioId,
      statusGeo: r.statusGoogle ?? r.motivo, enderecoBusca: endereco,
    })
    return { ok: false, motivo: r.motivo, erro: r.erro }
  }

  const candidatos = r.candidatos.map(c => comDistancia(c, posto))

  if (r.classe === 'forte') {
    const salvo = await persistirCandidato(db, posto, r.candidatos[0], endereco, opts.usuarioId, 'resultado único e preciso')
    if (!salvo.ok) return { ok: false, motivo: 'indisponivel', erro: salvo.erro }
    const escolhido = candidatos[0]
    return { ok: true, fonte: 'google', classe: 'forte', candidatos, escolhido, divergente: escolhido.distanciaPinoM != null && escolhido.distanciaPinoM > DIVERGENCIA_M }
  }

  // Ambíguo: nada é gravado como sugestão até a coordenação escolher. Só o texto digitado e o status.
  await db.from('postos').update({ endereco_busca: endereco, ...statusSeSemPonto(posto, 'ambiguo') }).eq('id', posto.id)
  await registrarHistoricoGeo(db, {
    postoId: posto.id, evento: 'geocodificacao_falhou', executadoPor: opts.usuarioId,
    statusGeo: 'AMBIGUO', enderecoBusca: endereco, detalhe: `${candidatos.length} candidato(s)`,
  })
  return { ok: true, fonte: 'google', classe: 'ambiguo', candidatos, escolhido: null, divergente: false }
}
