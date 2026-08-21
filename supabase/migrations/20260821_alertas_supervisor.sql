-- Canal de alertas do sistema direcionados a um supervisor específico — genérico,
-- não específico de INSS, serve de base pra outros tipos de alerta no futuro.
-- Diferente de log_supervisor_acoes (que registra ações QUE o supervisor fez, pro
-- admin acompanhar) — esta tabela é o oposto: alertas ENVIADOS ao supervisor.

CREATE TABLE alertas_supervisor (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  supervisor_id uuid        NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  tipo          text        NOT NULL,
  titulo        text        NOT NULL,
  detalhes      text,
  lido          boolean     NOT NULL DEFAULT false
);

CREATE INDEX idx_alertas_supervisor_supervisor ON alertas_supervisor(supervisor_id, lido);
CREATE INDEX idx_alertas_supervisor_created_at ON alertas_supervisor(created_at DESC);

ALTER TABLE alertas_supervisor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supervisor le proprios alertas" ON alertas_supervisor
  FOR SELECT USING (supervisor_id = auth.uid());

CREATE POLICY "supervisor atualiza proprios alertas" ON alertas_supervisor
  FOR UPDATE USING (supervisor_id = auth.uid()) WITH CHECK (supervisor_id = auth.uid());
