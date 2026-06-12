ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS motivo_afastamento TEXT
  CHECK (motivo_afastamento IN ('ausencia_temporaria', 'inss') OR motivo_afastamento IS NULL);
