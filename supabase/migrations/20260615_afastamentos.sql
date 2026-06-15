CREATE TABLE afastamentos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id    UUID NOT NULL REFERENCES funcionarios(id),
  motivo            TEXT,
  data_inicio       DATE NOT NULL,
  data_fim_prevista DATE,
  data_fim_real     DATE,
  solicitacao_id    UUID REFERENCES solicitacoes(id),
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_afastamentos_funcionario ON afastamentos (funcionario_id, data_inicio DESC);

ALTER TABLE afastamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY afastamentos_admin_all ON afastamentos
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());
