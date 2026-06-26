CREATE TABLE IF NOT EXISTS acordos_compensacao (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo           text        NOT NULL,
  tipo             text        NOT NULL CHECK (tipo IN ('individual', 'coletivo')),
  postos           jsonb       NOT NULL DEFAULT '[]',
  funcionarios     jsonb       NOT NULL DEFAULT '[]',
  horario_semana   jsonb       NOT NULL DEFAULT '{}',
  descricao_acordo text        NOT NULL DEFAULT '',
  data_documento   date        NOT NULL DEFAULT CURRENT_DATE,
  criado_por       uuid        REFERENCES auth.users(id),
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE acordos_compensacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can manage acordos"
  ON acordos_compensacao FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
