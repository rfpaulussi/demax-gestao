-- Controle de protocolo dos termos de movimentação no RH.
-- Aditiva. Aplicar no Supabase Studio (SQL Editor).
-- chave_termo: 'sol:<solicitacao_id>' quando há solicitação; 'mov:<movimentacao_id>' quando manual.

CREATE TABLE IF NOT EXISTS termos_protocolo (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave_termo    text NOT NULL UNIQUE,
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id),
  protocolado_em timestamptz NOT NULL DEFAULT now(),
  protocolado_por uuid NOT NULL REFERENCES perfis(id),
  observacao     text,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_termos_protocolo_func ON termos_protocolo (funcionario_id);

ALTER TABLE termos_protocolo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS termos_protocolo_select ON termos_protocolo;
CREATE POLICY termos_protocolo_select ON termos_protocolo
  FOR SELECT TO authenticated
  USING (
    is_admin_or_coord() OR is_viewer()
    OR funcionario_id IN (
      SELECT id FROM funcionarios WHERE posto_id IN (SELECT get_supervisor_posto_ids())
    )
  );
-- Escrita somente via service role (Server Actions com createAdminClient, que validam o escopo).
