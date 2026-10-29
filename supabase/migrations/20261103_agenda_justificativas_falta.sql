-- Agenda: "Fechar o dia". O supervisor justifica cada visita planejada que ficou sem check-in:
-- "fui, mas não registrei" ou o motivo de não ter ido. Alimenta o relatório de motivos das faltas.
-- Seguro rodar mais de uma vez.

CREATE TABLE IF NOT EXISTS agenda_justificativas_falta (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id     uuid NOT NULL REFERENCES agenda_semanas(id) ON DELETE CASCADE,
  data          date NOT NULL,
  posto_id      uuid NOT NULL REFERENCES postos(id),
  supervisor_id uuid NOT NULL REFERENCES perfis(id),
  tipo          text NOT NULL CHECK (tipo IN ('fui_sem_registro', 'emergencia', 'ausencia', 'direcao', 'feriado', 'outro')),
  texto         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (semana_id, data, posto_id)
);

CREATE INDEX IF NOT EXISTS agenda_justificativas_falta_semana_idx ON agenda_justificativas_falta (semana_id, data);

-- Acesso só pelo servidor (service role), como as demais tabelas da agenda.
ALTER TABLE agenda_justificativas_falta ENABLE ROW LEVEL SECURITY;
