-- ============================================================
-- 001_schema.sql — Demax Gestão — DDL completo
-- ============================================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Função de trigger para updated_at (reutilizada em várias tabelas)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. funcoes
-- ============================================================
CREATE TABLE funcoes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                  TEXT NOT NULL,
  insalubridade_perc    NUMERIC,
  periculosidade_perc   NUMERIC,
  salario_base          NUMERIC,
  insalubridade_valor   NUMERIC,
  periculosidade_valor  NUMERIC,
  ativo                 BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER funcoes_updated_at
  BEFORE UPDATE ON funcoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 2. custos_funcoes
-- ============================================================
CREATE TABLE custos_funcoes (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcao_id                  UUID NOT NULL REFERENCES funcoes(id),
  enc_inss                   NUMERIC,
  fgts                       NUMERIC,
  va                         NUMERIC,
  assid_asseio               NUMERIC,
  vr                         NUMERIC,
  vt                         NUMERIC,
  bss                        NUMERIC,
  aux_saude                  NUMERIC,
  plr                        NUMERIC,
  um_doze_decimo_terceiro    NUMERIC,
  um_terceiro_ferias         NUMERIC,
  enc_provisorio             NUMERIC,
  um_doze_lei_12506          NUMERIC,
  multa_40_pct               NUMERIC,
  total_por_func             NUMERIC,
  created_at                 TIMESTAMPTZ DEFAULT now(),
  updated_at                 TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER custos_funcoes_updated_at
  BEFORE UPDATE ON custos_funcoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 3. contratos
-- ============================================================
CREATE TABLE contratos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero       TEXT,
  secretaria   TEXT,
  objeto       TEXT,
  data_inicio  DATE,
  data_fim     DATE,
  valor_mensal NUMERIC,
  ativo        BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. postos
-- ============================================================
CREATE TABLE postos (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id          UUID REFERENCES contratos(id),
  nome                 TEXT NOT NULL,
  secretaria           TEXT,
  efetivo_previsto     INT,
  cota_insalubridade   INT DEFAULT 0,
  ativo                BOOLEAN DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER postos_updated_at
  BEFORE UPDATE ON postos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 5. composicao_postos
-- ============================================================
CREATE TABLE composicao_postos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posto_id   UUID NOT NULL REFERENCES postos(id),
  funcao_id  UUID NOT NULL REFERENCES funcoes(id),
  quantidade INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(posto_id, funcao_id)
);

-- ============================================================
-- 6. perfis
-- ============================================================
CREATE TABLE perfis (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       TEXT,
  email      TEXT UNIQUE,
  role       TEXT CHECK (role IN ('admin','coordenador','supervisor','viewer')),
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 7. config_supervisores_postos
-- ============================================================
CREATE TABLE config_supervisores_postos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id UUID NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  posto_id      UUID NOT NULL REFERENCES postos(id) ON DELETE CASCADE,
  ativo         BOOLEAN DEFAULT true
);

-- ============================================================
-- 8. funcionarios
-- ============================================================
CREATE TABLE funcionarios (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome               TEXT NOT NULL,
  cpf                TEXT UNIQUE,
  funcao_id          UUID REFERENCES funcoes(id),
  posto_id           UUID REFERENCES postos(id),
  status             TEXT CHECK (status IN ('ativo','afastado','ferias','desligado')),
  data_admissao      DATE,
  data_desligamento  DATE,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER funcionarios_updated_at
  BEFORE UPDATE ON funcionarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 9. coberturas_temporarias
-- ============================================================
CREATE TABLE coberturas_temporarias (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id      UUID NOT NULL REFERENCES funcionarios(id),
  posto_destino_id    UUID NOT NULL REFERENCES postos(id),
  posto_origem_id     UUID REFERENCES postos(id),           -- nullable (cobertura externa)
  motivo              TEXT,
  data_inicio         DATE,
  data_prev_retorno   DATE,
  data_retorno_real   DATE,
  urgencia            TEXT CHECK (urgencia IN ('baixa','media','alta')),
  status              TEXT CHECK (status IN ('ativa','encerrada')),
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 10. ferias
-- ============================================================
CREATE TABLE ferias (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES funcionarios(id),
  data_inicio    DATE,
  data_fim       DATE,
  observacao     TEXT,
  status         TEXT CHECK (status IN ('agendada','em_curso','concluida')),
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 11. atestados
-- ============================================================
CREATE TABLE atestados (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id   UUID NOT NULL REFERENCES funcionarios(id),
  posto_id         UUID NOT NULL REFERENCES postos(id),
  data_inicio      DATE NOT NULL,
  data_fim         DATE NOT NULL,
  motivo           TEXT,
  registrado_por   UUID NOT NULL REFERENCES perfis(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 12. advertencias
-- ============================================================
CREATE TABLE advertencias (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id   UUID NOT NULL REFERENCES funcionarios(id),
  tipo             TEXT,
  descricao        TEXT,
  data_ocorrencia  DATE,
  pdf_url          TEXT,
  status           TEXT CHECK (status IN ('pendente','gerada','entregue')),
  criado_por       UUID REFERENCES perfis(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 13. coberturas_insalubres
-- ============================================================
CREATE TABLE coberturas_insalubres (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES funcionarios(id),
  posto_id       UUID NOT NULL REFERENCES postos(id),
  data_inicio    DATE,
  data_fim       DATE,
  grau           TEXT CHECK (grau IN ('minimo','medio','maximo')),
  percentual     NUMERIC,
  declaracao_url TEXT,
  status         TEXT CHECK (status IN ('pendente','enviada')),
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 14. logs_alocacoes_mensais
-- ============================================================
CREATE TABLE logs_alocacoes_mensais (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posto_id            UUID NOT NULL REFERENCES postos(id),
  mes_referencia      DATE,
  efetivo_previsto    INT,
  efetivo_real        INT,
  nomes_funcionarios  JSONB,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 15. ocorrencias
-- ============================================================
CREATE TABLE ocorrencias (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posto_id         UUID NOT NULL REFERENCES postos(id),
  supervisor_id    UUID NOT NULL REFERENCES perfis(id),
  descricao        TEXT,
  data_ocorrencia  DATE,
  gravidade        TEXT CHECK (gravidade IN ('baixa','media','alta')),
  status           TEXT CHECK (status IN ('aberta','em_analise','encerrada')),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 16. transferencias
-- ============================================================
CREATE TABLE transferencias (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id         UUID NOT NULL REFERENCES funcionarios(id),
  posto_origem_id        UUID NOT NULL REFERENCES postos(id),
  posto_destino_id       UUID NOT NULL REFERENCES postos(id),
  data_transferencia     DATE,
  motivo                 TEXT,
  status                 TEXT CHECK (status IN ('aguardando','aprovada','rejeitada')) DEFAULT 'aguardando',
  observacao_coordenador TEXT,
  criado_por             UUID REFERENCES perfis(id),
  created_at             TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Índices em todas as FKs
-- ============================================================
CREATE INDEX idx_custos_funcoes_funcao_id          ON custos_funcoes(funcao_id);
CREATE INDEX idx_postos_contrato_id                ON postos(contrato_id);
CREATE INDEX idx_composicao_postos_posto_id        ON composicao_postos(posto_id);
CREATE INDEX idx_composicao_postos_funcao_id       ON composicao_postos(funcao_id);
CREATE INDEX idx_config_sup_postos_supervisor_id   ON config_supervisores_postos(supervisor_id);
CREATE INDEX idx_config_sup_postos_posto_id        ON config_supervisores_postos(posto_id);
CREATE INDEX idx_funcionarios_funcao_id            ON funcionarios(funcao_id);
CREATE INDEX idx_funcionarios_posto_id             ON funcionarios(posto_id);
CREATE INDEX idx_coberturas_temp_funcionario_id    ON coberturas_temporarias(funcionario_id);
CREATE INDEX idx_coberturas_temp_posto_destino_id  ON coberturas_temporarias(posto_destino_id);
CREATE INDEX idx_coberturas_temp_posto_origem_id   ON coberturas_temporarias(posto_origem_id);
CREATE INDEX idx_ferias_funcionario_id             ON ferias(funcionario_id);
CREATE INDEX idx_atestados_funcionario_id          ON atestados(funcionario_id);
CREATE INDEX idx_atestados_posto_id               ON atestados(posto_id);
CREATE INDEX idx_advertencias_funcionario_id       ON advertencias(funcionario_id);
CREATE INDEX idx_advertencias_criado_por           ON advertencias(criado_por);
CREATE INDEX idx_cob_insalubreis_funcionario_id    ON coberturas_insalubres(funcionario_id);
CREATE INDEX idx_cob_insalubreis_posto_id          ON coberturas_insalubres(posto_id);
CREATE INDEX idx_logs_alocacoes_posto_id           ON logs_alocacoes_mensais(posto_id);
CREATE INDEX idx_ocorrencias_posto_id              ON ocorrencias(posto_id);
CREATE INDEX idx_ocorrencias_supervisor_id         ON ocorrencias(supervisor_id);
CREATE INDEX idx_transferencias_funcionario_id     ON transferencias(funcionario_id);
CREATE INDEX idx_transferencias_posto_origem_id    ON transferencias(posto_origem_id);
CREATE INDEX idx_transferencias_posto_destino_id   ON transferencias(posto_destino_id);
CREATE INDEX idx_transferencias_criado_por         ON transferencias(criado_por);
