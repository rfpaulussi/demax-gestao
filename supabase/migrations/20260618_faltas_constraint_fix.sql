-- Remove constraint antiga (3 colunas: funcionario_id + data_falta + tipo)
ALTER TABLE faltas DROP CONSTRAINT IF EXISTS faltas_funcionario_id_data_falta_tipo_key;

-- Garante que constraint (2 colunas: funcionario_id + data_falta) existe e está nomeada corretamente
ALTER TABLE faltas DROP CONSTRAINT IF EXISTS faltas_funcionario_id_data_falta_key;
ALTER TABLE faltas ADD CONSTRAINT faltas_funcionario_id_data_falta_key
  UNIQUE (funcionario_id, data_falta);
