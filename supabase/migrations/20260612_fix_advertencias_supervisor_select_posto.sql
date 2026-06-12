-- ============================================================
-- Fix M4: ampliar advertencias_supervisor_select para incluir
-- todos os funcionários do posto do supervisor, não apenas
-- advertências criadas pelo próprio supervisor.
--
-- Antes: USING (is_supervisor() AND criado_por = auth.uid()) OR is_admin_or_coord()
-- Depois: supervisor vê advertências onde criou OU onde o funcionário
--         pertence a um dos seus postos.
-- ============================================================

DROP POLICY IF EXISTS advertencias_supervisor_select ON advertencias;

CREATE POLICY advertencias_supervisor_select ON advertencias
  FOR SELECT TO authenticated
  USING (
    (
      is_supervisor()
      AND (
        criado_por = auth.uid()
        OR funcionario_id IN (
          SELECT id FROM funcionarios
          WHERE posto_id IN (SELECT get_supervisor_posto_ids())
        )
      )
    )
    OR is_admin_or_coord()
  );
