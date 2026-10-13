-- Agenda: check-in guardado sem sinal e enviado depois.
-- local_id identifica o check-in no aparelho: reenvio do mesmo registro não duplica.
-- Seguro rodar mais de uma vez.

ALTER TABLE agenda_checkins ADD COLUMN IF NOT EXISTS local_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS agenda_checkins_local_id_key
  ON agenda_checkins (local_id)
  WHERE local_id IS NOT NULL;
