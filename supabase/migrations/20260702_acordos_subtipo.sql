-- Subtipo do acordo: evento (compensação por trabalho em evento) ou antecipado (banco de horas a compensar)
ALTER TABLE acordos_compensacao
  ADD COLUMN IF NOT EXISTS subtipo text
  CHECK (subtipo IN ('evento', 'antecipado'));
