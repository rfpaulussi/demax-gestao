ALTER TABLE ocorrencia_analises_ia
  DROP CONSTRAINT IF EXISTS ocorrencia_analises_ia_tipo_check;

ALTER TABLE ocorrencia_analises_ia
  ADD CONSTRAINT ocorrencia_analises_ia_tipo_check
  CHECK (tipo IN ('analise', 'devolutiva_retorno', 'consideracoes_rh'));
