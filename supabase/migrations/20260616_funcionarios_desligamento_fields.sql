-- Adiciona campos de registro e desligamento detalhado à tabela funcionarios

ALTER TABLE funcionarios
  ADD COLUMN IF NOT EXISTS registro            TEXT,
  ADD COLUMN IF NOT EXISTS tipo_desligamento   TEXT CHECK (tipo_desligamento IN ('voluntaria','demissao','reprova_experiencia','judicial','outros')),
  ADD COLUMN IF NOT EXISTS motivo_desligamento TEXT;
