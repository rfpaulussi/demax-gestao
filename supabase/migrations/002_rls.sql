-- ============================================================
-- 002_rls.sql — Demax Gestão — Row Level Security
-- ============================================================

-- ============================================================
-- Habilitar RLS em todas as tabelas
-- ============================================================
ALTER TABLE funcoes                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE custos_funcoes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE postos                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE composicao_postos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfis                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_supervisores_postos ENABLE ROW LEVEL SECURITY;
ALTER TABLE funcionarios               ENABLE ROW LEVEL SECURITY;
ALTER TABLE coberturas_temporarias     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ferias                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE atestados                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE advertencias               ENABLE ROW LEVEL SECURITY;
ALTER TABLE coberturas_insalubres      ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_alocacoes_mensais     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocorrencias                ENABLE ROW LEVEL SECURITY;
ALTER TABLE transferencias             ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Funções auxiliares (SECURITY DEFINER — bypass RLS interno)
-- ============================================================

-- Retorna true se o usuário logado é admin ou coordenador
CREATE OR REPLACE FUNCTION is_admin_or_coord()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfis
    WHERE id = auth.uid()
      AND role IN ('admin', 'coordenador')
      AND ativo = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Retorna true se o usuário logado é supervisor
CREATE OR REPLACE FUNCTION is_supervisor()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfis
    WHERE id = auth.uid()
      AND role = 'supervisor'
      AND ativo = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Retorna true se o usuário logado é viewer
CREATE OR REPLACE FUNCTION is_viewer()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfis
    WHERE id = auth.uid()
      AND role = 'viewer'
      AND ativo = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Retorna os posto_ids vinculados ao supervisor logado
CREATE OR REPLACE FUNCTION get_supervisor_posto_ids()
RETURNS SETOF UUID AS $$
  SELECT posto_id
  FROM config_supervisores_postos
  WHERE supervisor_id = auth.uid()
    AND ativo = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- FUNCOES — apenas admin/coord
-- ============================================================
CREATE POLICY funcoes_admin_all ON funcoes
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- ============================================================
-- CUSTOS_FUNCOES — apenas admin/coord
-- ============================================================
CREATE POLICY custos_funcoes_admin_all ON custos_funcoes
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- ============================================================
-- CONTRATOS — apenas admin/coord
-- ============================================================
CREATE POLICY contratos_admin_all ON contratos
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- ============================================================
-- POSTOS
-- ============================================================
CREATE POLICY postos_admin_all ON postos
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- supervisor: SELECT filtrado pelos seus postos
CREATE POLICY postos_supervisor_select ON postos
  FOR SELECT TO authenticated
  USING (
    is_supervisor()
    AND id IN (SELECT get_supervisor_posto_ids())
  );

-- viewer: SELECT em todos os postos
CREATE POLICY postos_viewer_select ON postos
  FOR SELECT TO authenticated
  USING (is_viewer());

-- ============================================================
-- COMPOSICAO_POSTOS
-- ============================================================
CREATE POLICY composicao_postos_admin_all ON composicao_postos
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- supervisor e viewer: SELECT irrestrito (tabela de referência)
CREATE POLICY composicao_postos_supervisor_select ON composicao_postos
  FOR SELECT TO authenticated
  USING (is_supervisor());

CREATE POLICY composicao_postos_viewer_select ON composicao_postos
  FOR SELECT TO authenticated
  USING (is_viewer());

-- ============================================================
-- PERFIS
-- ============================================================
CREATE POLICY perfis_admin_all ON perfis
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- qualquer usuário autenticado pode ler o próprio perfil
CREATE POLICY perfis_self_select ON perfis
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- ============================================================
-- CONFIG_SUPERVISORES_POSTOS
-- ============================================================
CREATE POLICY config_sup_postos_admin_all ON config_supervisores_postos
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- supervisor pode ler suas próprias vinculações
CREATE POLICY config_sup_postos_supervisor_select ON config_supervisores_postos
  FOR SELECT TO authenticated
  USING (
    is_supervisor()
    AND supervisor_id = auth.uid()
  );

-- ============================================================
-- FUNCIONARIOS
-- ============================================================
CREATE POLICY funcionarios_admin_all ON funcionarios
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- supervisor: SELECT filtrado pelos seus postos
CREATE POLICY funcionarios_supervisor_select ON funcionarios
  FOR SELECT TO authenticated
  USING (
    is_supervisor()
    AND posto_id IN (SELECT get_supervisor_posto_ids())
  );

-- viewer: SELECT em todos
CREATE POLICY funcionarios_viewer_select ON funcionarios
  FOR SELECT TO authenticated
  USING (is_viewer());

-- ============================================================
-- COBERTURAS_TEMPORARIAS
-- ============================================================
CREATE POLICY coberturas_temp_admin_all ON coberturas_temporarias
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- supervisor: SELECT onde posto_destino ou posto_origem é seu
CREATE POLICY coberturas_temp_supervisor_select ON coberturas_temporarias
  FOR SELECT TO authenticated
  USING (
    is_supervisor()
    AND (
      posto_destino_id IN (SELECT get_supervisor_posto_ids())
      OR posto_origem_id IN (SELECT get_supervisor_posto_ids())
    )
  );

-- viewer: SELECT em todas
CREATE POLICY coberturas_temp_viewer_select ON coberturas_temporarias
  FOR SELECT TO authenticated
  USING (is_viewer());

-- ============================================================
-- FERIAS
-- ============================================================
CREATE POLICY ferias_admin_all ON ferias
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- supervisor: SELECT por funcionários vinculados aos seus postos
CREATE POLICY ferias_supervisor_select ON ferias
  FOR SELECT TO authenticated
  USING (
    is_supervisor()
    AND funcionario_id IN (
      SELECT id FROM funcionarios
      WHERE posto_id IN (SELECT get_supervisor_posto_ids())
    )
  );

-- ============================================================
-- ATESTADOS
-- ============================================================
CREATE POLICY atestados_admin_all ON atestados
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- supervisor: SELECT filtrado pelos seus postos
CREATE POLICY atestados_supervisor_select ON atestados
  FOR SELECT TO authenticated
  USING (
    is_supervisor()
    AND posto_id IN (SELECT get_supervisor_posto_ids())
  );

-- supervisor: INSERT nos seus postos
CREATE POLICY atestados_supervisor_insert ON atestados
  FOR INSERT TO authenticated
  WITH CHECK (
    is_supervisor()
    AND posto_id IN (SELECT get_supervisor_posto_ids())
  );

-- ============================================================
-- ADVERTENCIAS — apenas admin/coord
-- ============================================================
CREATE POLICY advertencias_admin_all ON advertencias
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- ============================================================
-- COBERTURAS_INSALUBREIS — apenas admin/coord
-- ============================================================
CREATE POLICY cob_insalubres_admin_all ON coberturas_insalubres
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- ============================================================
-- LOGS_ALOCACOES_MENSAIS
-- ============================================================
CREATE POLICY logs_alocacoes_admin_all ON logs_alocacoes_mensais
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- supervisor: SELECT filtrado pelos seus postos
CREATE POLICY logs_alocacoes_supervisor_select ON logs_alocacoes_mensais
  FOR SELECT TO authenticated
  USING (
    is_supervisor()
    AND posto_id IN (SELECT get_supervisor_posto_ids())
  );

-- viewer: SELECT em todos
CREATE POLICY logs_alocacoes_viewer_select ON logs_alocacoes_mensais
  FOR SELECT TO authenticated
  USING (is_viewer());

-- ============================================================
-- OCORRENCIAS
-- ============================================================
CREATE POLICY ocorrencias_admin_all ON ocorrencias
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- supervisor: SELECT filtrado pelos seus postos
CREATE POLICY ocorrencias_supervisor_select ON ocorrencias
  FOR SELECT TO authenticated
  USING (
    is_supervisor()
    AND posto_id IN (SELECT get_supervisor_posto_ids())
  );

-- supervisor: INSERT nas ocorrencias dos seus postos
CREATE POLICY ocorrencias_supervisor_insert ON ocorrencias
  FOR INSERT TO authenticated
  WITH CHECK (
    is_supervisor()
    AND posto_id IN (SELECT get_supervisor_posto_ids())
  );

-- ============================================================
-- TRANSFERENCIAS — apenas admin/coord
-- ============================================================
CREATE POLICY transferencias_admin_all ON transferencias
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());
