-- ============================================================
-- Dossiê do funcionário: vincula ocorrencias a funcionario_id
-- e ajusta RLS de supervisor pra considerar o posto atual do
-- funcionário (além do posto_id direto, mantido por compat).
-- Também corrige um gap: supervisor nunca conseguia ver os
-- próprios alertas via RLS (posto_id é null em alertas e não
-- havia policy cobrindo esse caso).
-- ============================================================

ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS funcionario_id UUID REFERENCES funcionarios(id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_funcionario_id ON ocorrencias(funcionario_id);

DROP POLICY IF EXISTS ocorrencias_supervisor_select ON ocorrencias;
CREATE POLICY ocorrencias_supervisor_select ON ocorrencias
  FOR SELECT TO authenticated
  USING (
    is_supervisor()
    AND (
      posto_id IN (SELECT get_supervisor_posto_ids())
      OR funcionario_id IN (
        SELECT id FROM funcionarios
        WHERE posto_id IN (SELECT get_supervisor_posto_ids())
      )
      OR (tipo = 'alerta' AND supervisor_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS ocorrencias_supervisor_insert ON ocorrencias;
CREATE POLICY ocorrencias_supervisor_insert ON ocorrencias
  FOR INSERT TO authenticated
  WITH CHECK (
    is_supervisor()
    AND (
      funcionario_id IN (
        SELECT id FROM funcionarios
        WHERE posto_id IN (SELECT get_supervisor_posto_ids())
      )
      OR tipo = 'alerta'
    )
  );
