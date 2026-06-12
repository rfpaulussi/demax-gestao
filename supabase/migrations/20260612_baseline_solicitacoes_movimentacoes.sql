-- ============================================================
-- BASELINE — documentação retroativa (NÃO EXECUTAR NO BANCO ATUAL)
--
-- Tabelas solicitacoes e movimentacoes foram criadas diretamente
-- no dashboard do Supabase e nunca tiveram DDL versionado.
-- Esta migration registra o estado atual para permitir recriar
-- o projeto Supabase do zero a partir das migrations, se necessário.
--
-- IF NOT EXISTS e blocos DO/EXCEPTION garantem idempotência caso
-- alguém rode por engano, mas a intenção é que não seja executada.
-- ============================================================

-- ============================================================
-- SOLICITACOES
-- ============================================================
CREATE TABLE IF NOT EXISTS solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo = ANY (ARRAY['desligamento','transferencia','mudanca_funcao','promocao','mudanca_supervisor','alteracao_salario','afastamento','retorno_afastamento','rescisao_indireta'])),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status = ANY (ARRAY['pendente','aprovada','rejeitada'])),
  funcionario_id UUID NOT NULL REFERENCES funcionarios(id),
  supervisor_id UUID REFERENCES perfis(id),
  dados_antes JSONB,
  dados_depois JSONB,
  motivo TEXT,
  observacao_admin TEXT,
  aprovado_por UUID REFERENCES perfis(id),
  aprovado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  vigencia DATE,
  motivo_rejeicao TEXT
);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_status ON solicitacoes(status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_funcionario ON solicitacoes(funcionario_id);

ALTER TABLE solicitacoes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY solicitacoes_admin_all ON solicitacoes
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY solicitacoes_supervisor_select ON solicitacoes
    FOR SELECT TO authenticated
    USING (supervisor_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY solicitacoes_supervisor_insert ON solicitacoes
    FOR INSERT TO authenticated
    WITH CHECK (supervisor_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- MOVIMENTACOES
-- ============================================================
CREATE TABLE IF NOT EXISTS movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES funcionarios(id),
  tipo TEXT NOT NULL,
  campo_alterado TEXT,
  valor_antes TEXT,
  valor_depois TEXT,
  executado_por UUID REFERENCES perfis(id),
  solicitacao_id UUID REFERENCES solicitacoes(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_funcionario ON movimentacoes(funcionario_id);

ALTER TABLE movimentacoes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY movimentacoes_admin_all ON movimentacoes
    FOR ALL TO authenticated
    USING (is_admin_or_coord())
    WITH CHECK (is_admin_or_coord());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY movimentacoes_supervisor_select ON movimentacoes
    FOR SELECT TO authenticated
    USING (
      is_supervisor()
      AND funcionario_id IN (
        SELECT id FROM funcionarios
        WHERE posto_id IN (SELECT get_supervisor_posto_ids())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY movimentacoes_viewer_select ON movimentacoes
    FOR SELECT TO authenticated
    USING (is_viewer());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY movimentacoes_insert ON movimentacoes
    FOR INSERT TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
