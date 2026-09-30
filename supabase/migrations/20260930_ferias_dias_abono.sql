-- Dias vendidos (abono pecuniário) do período de férias.
-- Apenas registro: 0 = não vendeu; 10 = vendeu 10 dias (gozo = direito - abono).
ALTER TABLE ferias
  ADD COLUMN IF NOT EXISTS dias_abono integer NOT NULL DEFAULT 0;

ALTER TABLE ferias
  DROP CONSTRAINT IF EXISTS ferias_dias_abono_check;
ALTER TABLE ferias
  ADD CONSTRAINT ferias_dias_abono_check CHECK (dias_abono >= 0 AND dias_abono <= 10);
