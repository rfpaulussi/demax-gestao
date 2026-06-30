-- Adiciona coluna horarios (array de turnos com horário e funcionários)
-- Substitui horario_semana para novos acordos. Registros antigos mantêm horario_semana para compat.
ALTER TABLE acordos_compensacao
  ADD COLUMN IF NOT EXISTS horarios jsonb;
