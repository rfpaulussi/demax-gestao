-- Adiciona coluna para classificar a origem do atestado como acidente/doença ocupacional.
-- NULL = não ocupacional (padrão).
ALTER TABLE atestados
  ADD COLUMN IF NOT EXISTS origem_ocupacional TEXT
    CHECK (origem_ocupacional IN ('acidente_trabalho', 'doenca_ocupacional'));
