-- Corrige constraint de tipo e adiciona colunas de documento/justificativa
ALTER TABLE faltas DROP CONSTRAINT IF EXISTS faltas_tipo_check;
ALTER TABLE faltas ADD CONSTRAINT faltas_tipo_check
  CHECK (tipo IN ('sem_justificativa', 'declaracao', 'suspensao'));

ALTER TABLE faltas ADD COLUMN IF NOT EXISTS tem_documento BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE faltas ADD COLUMN IF NOT EXISTS justificativa TEXT;
