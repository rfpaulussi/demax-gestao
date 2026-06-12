-- ============================================================
-- Fix: adicionar policies em movimentacoes
-- RLS já estava habilitado mas sem nenhuma policy, bloqueando
-- todos os inserts feitos por usuários authenticated.
--
-- Estrutura inferida do código:
--   id             UUID pk
--   funcionario_id UUID FK funcionarios
--   tipo           TEXT
--   campo_alterado TEXT
--   valor_antes    TEXT
--   valor_depois   TEXT
--   executado_por  UUID FK perfis
--   solicitacao_id UUID FK solicitacoes (nullable)
--   created_at     TIMESTAMPTZ
-- ============================================================

-- admin/coord: acesso total
CREATE POLICY movimentacoes_admin_all ON movimentacoes
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- supervisor: SELECT filtrado pelos funcionários dos seus postos
CREATE POLICY movimentacoes_supervisor_select ON movimentacoes
  FOR SELECT TO authenticated
  USING (
    is_supervisor()
    AND funcionario_id IN (
      SELECT id FROM funcionarios
      WHERE posto_id IN (SELECT get_supervisor_posto_ids())
    )
  );

-- qualquer autenticado: INSERT (supervisores e admin geram movimentações
-- em fluxos distintos; nenhuma coluna sensível é escrita sem validação
-- na server action que chama o insert)
CREATE POLICY movimentacoes_insert ON movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- viewer: SELECT em todos (log de auditoria de leitura)
CREATE POLICY movimentacoes_viewer_select ON movimentacoes
  FOR SELECT TO authenticated
  USING (is_viewer());
