-- ============================================================
-- Fix: restringir policies permissivas em faltas e historico_funcionarios
-- Ambas tinham FOR ALL TO authenticated USING (true), permitindo que qualquer
-- supervisor lesse dados de qualquer posto.
-- ============================================================

-- ============================================================
-- FALTAS
-- ============================================================

-- Drop da policy irrestrita
DROP POLICY "authenticated full access" ON faltas;

-- admin/coord: acesso total
CREATE POLICY faltas_admin_all ON faltas
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- supervisor: SELECT filtrado pelos funcionários dos seus postos
CREATE POLICY faltas_supervisor_select ON faltas
  FOR SELECT TO authenticated
  USING (
    is_supervisor()
    AND funcionario_id IN (
      SELECT id FROM funcionarios
      WHERE posto_id IN (SELECT get_supervisor_posto_ids())
    )
  );

-- supervisor: INSERT restrito aos seus próprios funcionários
-- (impede registrar falta de funcionário de outro posto)
CREATE POLICY faltas_supervisor_insert ON faltas
  FOR INSERT TO authenticated
  WITH CHECK (
    is_supervisor()
    AND funcionario_id IN (
      SELECT id FROM funcionarios
      WHERE posto_id IN (SELECT get_supervisor_posto_ids())
    )
  );

-- viewer: SELECT em todos
CREATE POLICY faltas_viewer_select ON faltas
  FOR SELECT TO authenticated
  USING (is_viewer());

-- ============================================================
-- HISTORICO_FUNCIONARIOS
-- ============================================================

-- Drop da policy irrestrita
DROP POLICY "authenticated full access" ON historico_funcionarios;

-- admin/coord: acesso total
CREATE POLICY historico_admin_all ON historico_funcionarios
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- supervisor: SELECT filtrado pelos funcionários dos seus postos
CREATE POLICY historico_supervisor_select ON historico_funcionarios
  FOR SELECT TO authenticated
  USING (
    is_supervisor()
    AND funcionario_id IN (
      SELECT id FROM funcionarios
      WHERE posto_id IN (SELECT get_supervisor_posto_ids())
    )
  );

-- Nota: sem policy INSERT para supervisor.
-- Todos os inserts em historico_funcionarios vêm de:
--   (a) rotas (admin)/ — executadas por admin/coord, cobertos pelo ALL acima
--   (b) triggers do banco (SECURITY DEFINER) — bypass de RLS, não precisam de policy

-- viewer: SELECT em todos
CREATE POLICY historico_viewer_select ON historico_funcionarios
  FOR SELECT TO authenticated
  USING (is_viewer());
