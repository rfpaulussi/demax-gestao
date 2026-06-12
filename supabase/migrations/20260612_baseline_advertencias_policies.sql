-- ============================================================
-- BASELINE — documentação retroativa das policies de advertencias
-- (NÃO EXECUTAR NO BANCO ATUAL — policies já existem)
--
-- Três policies foram criadas diretamente no dashboard do Supabase
-- sem DDL versionado. Este arquivo as registra para permitir
-- recriar o projeto do zero a partir das migrations.
--
-- Nota: advertencias_supervisor_select será substituída pela
-- migration 20260612_fix_advertencias_supervisor_select_posto.sql,
-- que adiciona filtro por posto_id via funcionarios.
-- ============================================================

-- admin/coord: acesso total (documentada em 002_rls.sql, mas não aplicada
-- junto — foi criada via dashboard junto com as demais abaixo)
DO $$ BEGIN
  CREATE POLICY advertencias_admin_all ON advertencias
    FOR ALL TO authenticated
    USING (is_admin_or_coord())
    WITH CHECK (is_admin_or_coord());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- supervisor: INSERT (criada via dashboard)
DO $$ BEGIN
  CREATE POLICY advertencias_supervisor_insert ON advertencias
    FOR INSERT TO authenticated
    WITH CHECK (criado_por = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- supervisor: SELECT restrito ao próprio criador ou admin (comportamento
-- original — substituído pela migration de fix do M4)
-- USING reproduz exatamente o qual retornado pelo pg_policies.
DO $$ BEGIN
  CREATE POLICY advertencias_supervisor_select ON advertencias
    FOR SELECT TO authenticated
    USING (
      (criado_por = auth.uid())
      OR (EXISTS (
        SELECT 1 FROM perfis
        WHERE perfis.id = auth.uid()
          AND perfis.role = 'admin'
      ))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
