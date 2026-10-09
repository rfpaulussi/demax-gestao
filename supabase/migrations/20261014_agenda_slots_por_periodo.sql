-- Agenda: vários blocos por período (manhã/tarde), sem turno da noite na interface.
-- Aplicar no Supabase Studio (SQL Editor). Seguro rodar mais de uma vez.

ALTER TABLE agenda_blocos ADD COLUMN IF NOT EXISTS ordem smallint NOT NULL DEFAULT 1;

-- A unicidade passa a incluir a ordem (visita 1, 2, 3…) dentro do período.
ALTER TABLE agenda_blocos DROP CONSTRAINT IF EXISTS agenda_blocos_semana_id_data_periodo_key;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agenda_blocos_slot_unico') THEN
    ALTER TABLE agenda_blocos
      ADD CONSTRAINT agenda_blocos_slot_unico UNIQUE (semana_id, data, periodo, ordem);
  END IF;
END $$;
