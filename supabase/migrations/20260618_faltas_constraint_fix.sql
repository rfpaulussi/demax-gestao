-- Remove constraint antiga baseada em data_falta
ALTER TABLE faltas DROP CONSTRAINT IF EXISTS faltas_funcionario_id_data_falta_tipo_key;

-- Adiciona constraint correta baseada em data_inicio
ALTER TABLE faltas DROP CONSTRAINT IF EXISTS faltas_funcionario_id_data_inicio_key;
ALTER TABLE faltas ADD CONSTRAINT faltas_funcionario_id_data_inicio_key
  UNIQUE (funcionario_id, data_inicio);

-- Garante que data_falta espelha data_inicio para compatibilidade
UPDATE faltas SET data_falta = data_inicio WHERE data_falta IS NULL AND data_inicio IS NOT NULL;
