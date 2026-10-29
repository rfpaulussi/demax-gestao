-- Agenda: integridade dos check-ins e permanência mínima por foco.
-- Seguro rodar mais de uma vez.

-- Permanência mínima (minutos) por tipo de foco. Vazio = padrão de 10 min; 0 = sem alerta de permanência curta.
ALTER TABLE agenda_tipos_foco ADD COLUMN IF NOT EXISTS permanencia_minima_min integer
  CHECK (permanencia_minima_min IS NULL OR (permanencia_minima_min >= 0 AND permanencia_minima_min <= 480));

-- Impressão digital (SHA-256) da foto do check-in: impede usar a mesma foto em visitas diferentes.
ALTER TABLE agenda_checkins ADD COLUMN IF NOT EXISTS foto_hash text;
CREATE INDEX IF NOT EXISTS agenda_checkins_foto_hash_idx ON agenda_checkins (foto_hash) WHERE foto_hash IS NOT NULL;
