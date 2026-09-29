-- No máximo 1 afastamento aberto (data_fim_real IS NULL) por funcionário.
-- Pré-requisito: nenhum funcionário com mais de 1 aberto (saneado em 29/09/2026 pelo Revisor Operacional).
CREATE UNIQUE INDEX IF NOT EXISTS afastamentos_um_aberto_por_funcionario
  ON afastamentos (funcionario_id)
  WHERE data_fim_real IS NULL;
