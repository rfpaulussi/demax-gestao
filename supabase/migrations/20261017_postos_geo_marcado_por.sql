-- Supervisor pode marcar a localização do posto pelo GPS quando está no local (fica "a conferir").
-- Requer a migração 20261016 (geo_confirmado / geo_precisao). Seguro rodar mais de uma vez.

ALTER TABLE postos
  ADD COLUMN IF NOT EXISTS geo_marcado_por uuid REFERENCES perfis(id),
  ADD COLUMN IF NOT EXISTS geo_marcado_em  timestamptz;
