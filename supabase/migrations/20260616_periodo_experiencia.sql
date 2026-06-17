-- Controle de período de experiência dos funcionários
ALTER TABLE funcionarios
  ADD COLUMN IF NOT EXISTS periodo_experiencia TEXT
    CHECK (periodo_experiencia IN ('30+30', '45+45')),
  ADD COLUMN IF NOT EXISTS fase_experiencia TEXT
    CHECK (fase_experiencia IN ('1', '2', 'concluido')),
  ADD COLUMN IF NOT EXISTS data_fim_fase1 DATE,
  ADD COLUMN IF NOT EXISTS data_fim_fase2 DATE;
