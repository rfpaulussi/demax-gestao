-- Localização dos postos: distingue coordenada conferida de coordenada importada (geocodificação automática).
-- Aplicar no Supabase Studio (SQL Editor). Seguro rodar mais de uma vez.

ALTER TABLE postos
  ADD COLUMN IF NOT EXISTS geo_confirmado boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS geo_precisao text; -- 'alta' (equipamento/prédio) | 'media' (rua) | 'baixa'

COMMENT ON COLUMN postos.geo_confirmado IS 'false = coordenada importada automaticamente, ainda não conferida no mapa';
COMMENT ON COLUMN postos.geo_precisao IS 'precisão da geocodificação automática: alta | media | baixa';
