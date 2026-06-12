-- Remove policies "authenticated full access" (USING true, WITH CHECK true)
-- criadas via dashboard sem revisão de segurança.
-- Restringe config_escalas_postos, fechamentos, fechamento_itens a admin/coord.
-- insalubridade_coberturas já tinha ins_cob_admin_all cobrindo o necessário.

DROP POLICY IF EXISTS "authenticated full access" ON insalubridade_coberturas;

DROP POLICY IF EXISTS "authenticated full access" ON config_escalas_postos;
CREATE POLICY config_escalas_postos_admin_all ON config_escalas_postos
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

DROP POLICY IF EXISTS "authenticated full access" ON fechamentos;
CREATE POLICY fechamentos_admin_all ON fechamentos
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

DROP POLICY IF EXISTS "authenticated full access" ON fechamento_itens;
CREATE POLICY fechamento_itens_admin_all ON fechamento_itens
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());
