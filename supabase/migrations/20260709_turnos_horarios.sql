-- Turnos de trabalho por posto (horário completo nomeado)
CREATE TABLE turnos_postos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posto_id            UUID NOT NULL REFERENCES postos(id) ON DELETE CASCADE,
  nome                TEXT NOT NULL,
  hora_entrada        TIME NOT NULL,
  hora_saida_seg_qui  TIME NOT NULL,
  hora_saida_sex      TIME NOT NULL,
  hora_inicio_almoco  TIME NOT NULL,
  hora_fim_almoco     TIME NOT NULL,
  ativo               BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (posto_id, nome)
);

-- Histórico de turnos por funcionário (com data de vigência)
CREATE TABLE horarios_funcionarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id  UUID NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  turno_id        UUID NOT NULL REFERENCES turnos_postos(id),
  data_inicio     DATE NOT NULL,
  data_fim        DATE,
  criado_por      UUID REFERENCES perfis(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_horarios_funcionarios_func    ON horarios_funcionarios(funcionario_id);
CREATE INDEX idx_horarios_funcionarios_vigente ON horarios_funcionarios(funcionario_id) WHERE data_fim IS NULL;
CREATE INDEX idx_turnos_postos_posto           ON turnos_postos(posto_id);

-- Adicionar campo de descrição legível ao regime do posto
ALTER TABLE config_escalas_postos ADD COLUMN IF NOT EXISTS descricao TEXT;

-- RLS
ALTER TABLE turnos_postos ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_funcionarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "turnos_postos_select" ON turnos_postos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "turnos_postos_write" ON turnos_postos
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM perfis WHERE id = auth.uid() AND role IN ('admin', 'coordenador')
  ));

CREATE POLICY "horarios_funcionarios_select" ON horarios_funcionarios
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "horarios_funcionarios_write" ON horarios_funcionarios
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM perfis WHERE id = auth.uid() AND role IN ('admin', 'coordenador')
  ));
