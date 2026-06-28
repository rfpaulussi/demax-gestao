-- Corrige RLS da tabela movimentacoes (log de auditoria)
-- Antes: qualquer autenticado podia inserir com executado_por arbitrário (forjar log)
-- Depois: INSERT restrito ao próprio uid do chamador

-- Supervisores e viewers que inserem via Server Actions continuam funcionando
-- pois as actions sempre passam auth.user.id como executado_por.
-- Admin/coord continuam cobertos pela policy movimentacoes_admin_all (FOR ALL).

DROP POLICY IF EXISTS movimentacoes_insert ON movimentacoes;

CREATE POLICY movimentacoes_insert ON movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (executado_por = auth.uid());
