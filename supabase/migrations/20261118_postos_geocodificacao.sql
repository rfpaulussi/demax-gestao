-- Geocodificação dos postos (Google Geocoding API) — Fase 1. Aditiva: nada é removido nem reescrito.
-- Aplicar no Supabase Studio (SQL Editor). Seguro rodar mais de uma vez.
--
-- Regra dos termos do Google (Geocoding API 6.2/6.3): coordenada devolvida pelo Google só pode ficar em cache por
-- até 30 dias e não pode ser usada junto com mapa não-Google. Por isso o resultado do Google vive em colunas
-- separadas (geo_google_*, com geo_google_expira_em) e NUNCA entra em postos.latitude/longitude. O ponto oficial
-- do posto continua vindo do GPS do supervisor ou da marcação manual da coordenação. O place_id pode ficar sem prazo.

ALTER TABLE postos
  ADD COLUMN IF NOT EXISTS endereco_busca        text,              -- texto enviado ao Google (editável)
  ADD COLUMN IF NOT EXISTS geo_origem            text,              -- origem do ponto oficial
  ADD COLUMN IF NOT EXISTS geo_status            text NOT NULL DEFAULT 'sem_coordenada',
  ADD COLUMN IF NOT EXISTS geo_confirmado_por    uuid REFERENCES perfis(id),
  ADD COLUMN IF NOT EXISTS geo_confirmado_em     timestamptz,
  ADD COLUMN IF NOT EXISTS geo_place_id          text,
  ADD COLUMN IF NOT EXISTS geo_endereco_hash     text,              -- hash do endereco_busca já geocodificado (evita chamada repetida)
  ADD COLUMN IF NOT EXISTS geo_google_lat        double precision,  -- sugestão do Google: expira em 30 dias
  ADD COLUMN IF NOT EXISTS geo_google_lng        double precision,
  ADD COLUMN IF NOT EXISTS geo_google_endereco   text,
  ADD COLUMN IF NOT EXISTS geo_google_tipo       text,              -- ROOFTOP | RANGE_INTERPOLATED | GEOMETRIC_CENTER | APPROXIMATE
  ADD COLUMN IF NOT EXISTS geo_google_parcial    boolean,
  ADD COLUMN IF NOT EXISTS geo_google_em         timestamptz,
  ADD COLUMN IF NOT EXISTS geo_google_expira_em  timestamptz;

ALTER TABLE postos DROP CONSTRAINT IF EXISTS postos_geo_origem_check;
ALTER TABLE postos ADD CONSTRAINT postos_geo_origem_check
  CHECK (geo_origem IS NULL OR geo_origem IN ('nominatim', 'gps_supervisor', 'manual_mapa'));

ALTER TABLE postos DROP CONSTRAINT IF EXISTS postos_geo_status_check;
ALTER TABLE postos ADD CONSTRAINT postos_geo_status_check
  CHECK (geo_status IN ('sem_coordenada', 'a_conferir', 'confirmado', 'ambiguo', 'nao_encontrado', 'erro'));

-- Preenche origem e status dos postos que já têm ponto, a partir das colunas antigas (sem alterar latitude/longitude).
UPDATE postos SET geo_origem = CASE
    WHEN geo_precisao = 'gps' THEN 'gps_supervisor'
    WHEN geo_confirmado = false THEN 'nominatim'
    ELSE 'manual_mapa'
  END
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND geo_origem IS NULL;

UPDATE postos SET geo_status = CASE
    WHEN latitude IS NULL OR longitude IS NULL THEN 'sem_coordenada'
    WHEN geo_confirmado = false THEN 'a_conferir'
    ELSE 'confirmado'
  END
WHERE geo_status = 'sem_coordenada';

COMMENT ON COLUMN postos.geo_origem IS 'origem do ponto oficial: nominatim (importado) | gps_supervisor | manual_mapa';
COMMENT ON COLUMN postos.geo_google_lat IS 'sugestão do Google Geocoding: cache de no máximo 30 dias (geo_google_expira_em); nunca vira o ponto oficial sozinha';

-- Histórico de alterações do ponto oficial e das geocodificações (somente inserção).
CREATE TABLE IF NOT EXISTS postos_geo_historico (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posto_id       uuid NOT NULL REFERENCES postos(id) ON DELETE CASCADE,
  evento         text NOT NULL,   -- geocodificado | confirmado_mapa | marcado_gps | proposta_aprovada | removido | geocodificacao_falhou
  latitude       double precision, -- ponto oficial gravado (nunca coordenada do Google)
  longitude      double precision,
  raio_m         integer,
  origem         text,
  status_geo     text,             -- status devolvido pelo Google: OK, ZERO_RESULTS, ...
  place_id       text,
  endereco_busca text,
  detalhe        text,
  executado_por  uuid REFERENCES perfis(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS postos_geo_historico_posto_idx ON postos_geo_historico (posto_id, created_at DESC);

-- Acesso somente via service role nas Server Actions (RLS ligado, sem policies), como as demais tabelas de geo.
ALTER TABLE postos_geo_historico ENABLE ROW LEVEL SECURITY;
