// Histórico de alterações do ponto oficial dos postos e das geocodificações (tabela postos_geo_historico, migração 20261118).
// Servidor apenas. Falha em gravar o histórico nunca pode bloquear a ação principal.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyClient = { from: (table: string) => any }

export type EventoGeo =
  | 'geocodificado'
  | 'geocodificacao_falhou'
  | 'confirmado_mapa'
  | 'marcado_gps'
  | 'proposta_aprovada'
  | 'removido'

export type DadosHistoricoGeo = {
  postoId: string
  evento: EventoGeo
  executadoPor?: string | null
  latitude?: number | null // só ponto oficial; coordenada do Google nunca entra aqui
  longitude?: number | null
  raioM?: number | null
  origem?: string | null
  statusGeo?: string | null
  placeId?: string | null
  enderecoBusca?: string | null
  detalhe?: string | null
}

export async function registrarHistoricoGeo(db: AnyClient, d: DadosHistoricoGeo): Promise<void> {
  try {
    await db.from('postos_geo_historico').insert({
      posto_id: d.postoId,
      evento: d.evento,
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      raio_m: d.raioM ?? null,
      origem: d.origem ?? null,
      status_geo: d.statusGeo ?? null,
      place_id: d.placeId ?? null,
      endereco_busca: d.enderecoBusca ?? null,
      detalhe: d.detalhe ? d.detalhe.slice(0, 300) : null,
      executado_por: d.executadoPor ?? null,
    })
  } catch {
    // migração ainda não aplicada ou erro de rede: o histórico é complementar
  }
}
