-- Convenções coletivas de trabalho
CREATE TABLE convencoes_coletivas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao             TEXT NOT NULL,
  data_vigencia_inicio  DATE NOT NULL,
  data_vigencia_fim     DATE NOT NULL,
  percentual_reajuste   NUMERIC(5,2),
  observacoes           TEXT,
  status                TEXT NOT NULL DEFAULT 'rascunho'
                        CHECK (status IN ('rascunho', 'publicada', 'aplicada')),
  criada_por            UUID REFERENCES perfis(id),
  aplicada_em           TIMESTAMPTZ,
  aplicada_por          UUID REFERENCES perfis(id),
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- Snapshot dos valores por função definidos na convenção
CREATE TABLE convencao_valores_funcoes (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convencao_id              UUID NOT NULL REFERENCES convencoes_coletivas(id) ON DELETE CASCADE,
  funcao_id                 UUID NOT NULL REFERENCES funcoes(id),
  salario_base              NUMERIC(10,2) NOT NULL,
  insalubridade_perc        NUMERIC(5,2),
  insalubridade_valor       NUMERIC(10,2),
  periculosidade_perc       NUMERIC(5,2),
  periculosidade_valor      NUMERIC(10,2),
  va                        NUMERIC(10,2),
  vr                        NUMERIC(10,2),
  vt                        NUMERIC(10,2),
  enc_inss                  NUMERIC(10,2),
  fgts                      NUMERIC(10,2),
  assid_asseio              NUMERIC(10,2),
  bss                       NUMERIC(10,2),
  aux_saude                 NUMERIC(10,2),
  plr                       NUMERIC(10,2),
  um_doze_decimo_terceiro   NUMERIC(10,2),
  um_terceiro_ferias        NUMERIC(10,2),
  enc_provisorio            NUMERIC(10,2),
  um_doze_lei_12506         NUMERIC(10,2),
  multa_40_pct              NUMERIC(10,2),
  total_por_func            NUMERIC(10,2),
  UNIQUE (convencao_id, funcao_id)
);

CREATE INDEX idx_convencao_valores_convencao ON convencao_valores_funcoes(convencao_id);
CREATE INDEX idx_convencao_valores_funcao    ON convencao_valores_funcoes(funcao_id);

-- RLS
ALTER TABLE convencoes_coletivas ENABLE ROW LEVEL SECURITY;
ALTER TABLE convencao_valores_funcoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "convencoes_select" ON convencoes_coletivas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "convencoes_write" ON convencoes_coletivas
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM perfis WHERE id = auth.uid() AND role IN ('admin', 'coordenador')
  ));

CREATE POLICY "convencao_valores_select" ON convencao_valores_funcoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "convencao_valores_write" ON convencao_valores_funcoes
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM perfis WHERE id = auth.uid() AND role IN ('admin', 'coordenador')
  ));
