-- Agenda Fase 2: localização dos postos + check-in georreferenciado.
-- Aplicar no Supabase Studio (SQL Editor). Acesso via service role (RLS ligado, sem policies).

ALTER TABLE postos
  ADD COLUMN IF NOT EXISTS latitude  double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS raio_m    integer NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS endereco_ref text;

CREATE TABLE IF NOT EXISTS agenda_checkins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id uuid NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  posto_id      uuid NOT NULL REFERENCES postos(id),
  bloco_id      uuid REFERENCES agenda_blocos(id) ON DELETE SET NULL,
  tipo          text NOT NULL CHECK (tipo IN ('entrada','saida')),
  latitude      double precision NOT NULL,
  longitude     double precision NOT NULL,
  precisao_m    double precision,
  distancia_m   double precision,
  dentro_raio   boolean NOT NULL DEFAULT false,
  baixa_precisao boolean NOT NULL DEFAULT false,
  justificativa text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agenda_checkins_sup_data_idx ON agenda_checkins (supervisor_id, created_at);
CREATE INDEX IF NOT EXISTS agenda_checkins_posto_idx ON agenda_checkins (posto_id);

ALTER TABLE agenda_checkins ENABLE ROW LEVEL SECURITY;
