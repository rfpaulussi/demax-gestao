-- ============================================================
-- Fix: habilitar RLS e adicionar policies em insalubridade_coberturas
-- Tabela criada em 20260608 sem RLS — acesso estava irrestrito.
-- Segue o mesmo padrão de coberturas_temporarias em 002_rls.sql.
-- ============================================================

ALTER TABLE insalubridade_coberturas ENABLE ROW LEVEL SECURITY;

-- admin/coord: acesso total
CREATE POLICY ins_cob_admin_all ON insalubridade_coberturas
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- supervisor: SELECT filtrado pelo posto_id do registro
-- (posto_id registra onde a cobertura ocorreu, mesmo campo usado em coberturas_temporarias)
CREATE POLICY ins_cob_supervisor_select ON insalubridade_coberturas
  FOR SELECT TO authenticated
  USING (
    is_supervisor()
    AND posto_id IN (SELECT get_supervisor_posto_ids())
  );

-- viewer: SELECT em todos os registros (sem filtro de posto)
CREATE POLICY ins_cob_viewer_select ON insalubridade_coberturas
  FOR SELECT TO authenticated
  USING (is_viewer());
