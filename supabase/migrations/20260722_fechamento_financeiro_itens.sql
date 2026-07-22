-- Snapshot detalhado por funcionário de um fechamento financeiro salvo.
-- Complementa fechamento_financeiro_resumos (que só guarda agregados): ao
-- salvar um fechamento, cada linha calculada naquele momento é congelada aqui,
-- para que reabrir um mês já salvo não recalcule com taxas atuais de
-- Funções e Salários.
CREATE TABLE fechamento_financeiro_itens (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes                  SMALLINT NOT NULL,
  ano                  SMALLINT NOT NULL,
  funcionario_id       UUID NOT NULL,
  funcionario_nome     TEXT NOT NULL,
  registro             TEXT,
  funcao               TEXT,
  posto_nome           TEXT,
  secretaria           TEXT,
  regime               TEXT NOT NULL,
  periodo_inicio       DATE NOT NULL,
  periodo_fim          DATE NOT NULL,
  dias_uteis           INTEGER NOT NULL,
  dias_trabalhados     INTEGER NOT NULL,
  dias_ferias          INTEGER NOT NULL,
  dias_atestado        INTEGER NOT NULL,
  dias_falta           INTEGER NOT NULL,
  dias_suspensao       INTEGER NOT NULL,
  dias_afastamento     INTEGER NOT NULL,
  proporcao_paga       NUMERIC NOT NULL,
  bonus_terco_ferias   NUMERIC NOT NULL,
  proporcao_final      NUMERIC NOT NULL,
  salario_base         NUMERIC(10,2) NOT NULL,
  insalubridade_valor  NUMERIC(10,2) NOT NULL,
  insalubridade_perc   NUMERIC(5,2),
  periculosidade_valor NUMERIC(10,2) NOT NULL,
  periculosidade_perc  NUMERIC(5,2),
  salario_bruto        NUMERIC(10,2) NOT NULL,
  salario_prop         NUMERIC(10,2) NOT NULL,
  custo_total          NUMERIC(10,2),
  custo_prop           NUMERIC(10,2),
  custo_detalhe        JSONB,
  custo_ferias_extra   NUMERIC(10,2) NOT NULL,
  sem_custo            BOOLEAN NOT NULL,
  is_afastado          BOOLEAN NOT NULL,
  em_ferias            BOOLEAN NOT NULL,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mes, ano, funcionario_id)
);

CREATE INDEX idx_fechamento_financeiro_itens_periodo ON fechamento_financeiro_itens(ano, mes);

ALTER TABLE fechamento_financeiro_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fechamento_financeiro_itens_admin_all" ON fechamento_financeiro_itens
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());
