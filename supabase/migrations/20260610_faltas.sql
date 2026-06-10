-- Tabela de faltas
CREATE TABLE faltas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id   UUID NOT NULL REFERENCES funcionarios(id),
  data_falta       DATE NOT NULL,
  tipo             TEXT NOT NULL CHECK (tipo IN ('sem_atestado', 'com_atestado', 'suspensao')),
  dias             INTEGER NOT NULL DEFAULT 1,
  observacao       TEXT,
  registrado_por   UUID NOT NULL REFERENCES perfis(id),
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(funcionario_id, data_falta, tipo)
);

CREATE INDEX idx_faltas_funcionario_id ON faltas(funcionario_id);
CREATE INDEX idx_faltas_data_falta     ON faltas(data_falta);
CREATE INDEX idx_faltas_registrado_por ON faltas(registrado_por);

-- RLS
ALTER TABLE faltas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access"
ON faltas FOR ALL TO authenticated
USING (true) WITH CHECK (true);
