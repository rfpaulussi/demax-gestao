-- Log de ações realizadas por supervisores
-- Usado para notificar o admin sobre alterações feitas por supervisores

CREATE TABLE IF NOT EXISTS log_supervisor_acoes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  supervisor_id  uuid        REFERENCES perfis(id) ON DELETE SET NULL,
  supervisor_nome text       NOT NULL DEFAULT '',
  tipo           text        NOT NULL, -- 'atestado' | 'advertencia' | 'falta' | 'cobertura'
  acao           text        NOT NULL, -- 'criou' | 'editou' | 'excluiu'
  funcionario_nome text,
  detalhes       text,
  lido           boolean     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_log_supervisor_lido
  ON log_supervisor_acoes(lido) WHERE NOT lido;

CREATE INDEX IF NOT EXISTS idx_log_supervisor_created_at
  ON log_supervisor_acoes(created_at DESC);

-- Admin pode ler tudo; supervisores não têm acesso a este log
ALTER TABLE log_supervisor_acoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin lê log_supervisor_acoes"
  ON log_supervisor_acoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM perfis
      WHERE perfis.id = auth.uid()
        AND perfis.role IN ('admin', 'coordenador')
    )
  );
