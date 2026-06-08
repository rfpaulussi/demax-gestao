CREATE TABLE IF NOT EXISTS insalubridade_coberturas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID REFERENCES funcionarios(id) NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL,
  data_cobertura DATE NOT NULL,
  agente_ausente_id UUID REFERENCES funcionarios(id),
  agente_ausente_nome TEXT,
  posto_id UUID REFERENCES postos(id),
  origem TEXT DEFAULT 'manual' CHECK (origem IN ('manual', 'cobertura')),
  cobertura_id UUID,
  percentual NUMERIC(5,2) DEFAULT 40.00,
  observacao TEXT,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'pago')),
  criado_por UUID REFERENCES perfis(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(funcionario_id, data_cobertura)
);

CREATE INDEX IF NOT EXISTS idx_ins_cob_mes_ano ON insalubridade_coberturas(ano, mes);
CREATE INDEX IF NOT EXISTS idx_ins_cob_func ON insalubridade_coberturas(funcionario_id);
