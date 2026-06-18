-- Estende faltas para rastreamento de coberturas por falta
ALTER TABLE faltas ADD COLUMN IF NOT EXISTS data_fim DATE;
ALTER TABLE faltas ADD COLUMN IF NOT EXISTS origem varchar(20);
ALTER TABLE faltas ADD COLUMN IF NOT EXISTS cobertura_id uuid;

-- Atualiza CHECK constraint de tipo para incluir novos tipos de falta por cobertura
ALTER TABLE faltas DROP CONSTRAINT IF EXISTS faltas_tipo_check;
ALTER TABLE faltas ADD CONSTRAINT faltas_tipo_check
  CHECK (tipo IN (
    'sem_atestado', 'com_atestado', 'suspensao',
    'sem_justificativa', 'declaracao',
    'falta_justificada', 'falta_injustificada'
  ));
