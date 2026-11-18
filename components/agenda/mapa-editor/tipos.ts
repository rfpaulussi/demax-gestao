// Contrato comum dos dois mapas do editor de locais (OpenStreetMap/Leaflet e Google Maps).
// O editor só fala com esta interface; qual motor desenha o mapa é detalhe de cada adaptador.

export type Pos = { lat: number; lng: number }
export type PontoOutro = { id: string; nome: string; lat: number; lng: number }

export interface MapaEditor {
  /** 'google' = mapa do Google (único motor onde a sugestão do Google pode virar pino, termos 6.2). */
  readonly motor: 'leaflet' | 'google'
  irPara(p: Pos, zoom?: number): void
  /** Pino arrastável do posto selecionado + círculo do raio. null remove os dois. */
  setPino(p: Pos | null, raioM: number): void
  setRaio(raioM: number): void
  /** Demais postos já localizados (contexto). Só pontos oficiais, nunca conteúdo do Google. */
  setOutros(pontos: PontoOutro[]): void
  destruir(): void
}

export type EventosMapa = {
  onClick(p: Pos): void
  onArrastar(p: Pos): void
  /** Chave recusada pelo Google (referrer, API desativada, cobrança): o editor volta ao mapa OpenStreetMap. */
  onFalha?(): void
}
