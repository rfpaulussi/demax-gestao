-- Agenda: o admin libera um dia que já passou para o supervisor corrigir (vale por tempo limitado).
-- Seguro rodar mais de uma vez.

CREATE TABLE IF NOT EXISTS agenda_liberacoes_dia (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id    uuid NOT NULL REFERENCES agenda_semanas(id) ON DELETE CASCADE,
  data         date NOT NULL,
  liberado_por uuid NOT NULL REFERENCES perfis(id),
  expira_em    timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agenda_liberacoes_dia_semana_idx ON agenda_liberacoes_dia (semana_id, expira_em);

-- Acesso só pelo servidor (service role), como as demais tabelas da agenda.
ALTER TABLE agenda_liberacoes_dia ENABLE ROW LEVEL SECURITY;
