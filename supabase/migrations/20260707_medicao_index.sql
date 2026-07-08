-- Índice em mes_referencia para queries de medição (WHERE mes_referencia = ?)
CREATE INDEX IF NOT EXISTS idx_logs_alocacoes_mes_referencia
  ON logs_alocacoes_mensais (mes_referencia);
