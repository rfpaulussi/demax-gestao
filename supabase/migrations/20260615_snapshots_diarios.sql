-- Tabela para snapshots diários dos KPIs do dashboard
CREATE TABLE IF NOT EXISTS snapshots_diarios (
  data                 DATE PRIMARY KEY,
  ativos               INT  NOT NULL,
  afastados            INT  NOT NULL,
  em_ferias            INT  NOT NULL,
  postos_deficit       INT  NOT NULL,
  aprovacoes_pendentes INT  NOT NULL,
  coberturas_ativas    INT  NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE snapshots_diarios ENABLE ROW LEVEL SECURITY;

-- Leitura liberada para autenticados (dado agregado, sem PII)
CREATE POLICY "snapshots_diarios_select"
  ON snapshots_diarios
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE apenas via service role (cron) — sem policy para authenticated
