ALTER TABLE insalubridade_coberturas
ADD COLUMN IF NOT EXISTS periodo_dias integer NOT NULL DEFAULT 1;
