-- ============================================================
-- Fix M4: adicionar policies SELECT para viewer em ferias,
-- atestados e ocorrencias. Tabelas tinham RLS habilitado mas
-- nenhuma policy viewer, bloqueando leitura para esse perfil.
-- Segue o padrão de postos_viewer_select e funcionarios_viewer_select
-- definidos em 002_rls.sql.
-- ============================================================

CREATE POLICY ferias_viewer_select ON ferias
  FOR SELECT TO authenticated
  USING (is_viewer());

CREATE POLICY atestados_viewer_select ON atestados
  FOR SELECT TO authenticated
  USING (is_viewer());

CREATE POLICY ocorrencias_viewer_select ON ocorrencias
  FOR SELECT TO authenticated
  USING (is_viewer());
