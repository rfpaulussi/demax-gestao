-- ============================================================
-- Assistente de IA para ocorrências: auditoria de cada chamada e da decisão.
-- texto_enviado = exatamente o que foi à API (já anonimizado).
-- mapa = FUNC_n -> nome real, fica só no servidor (tabela sem acesso de supervisor/viewer).
-- ============================================================

CREATE TABLE IF NOT EXISTS ocorrencia_analises_ia (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  ocorrencia_id   uuid        NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
  tipo            text        NOT NULL DEFAULT 'analise' CHECK (tipo IN ('analise', 'devolutiva_retorno')),
  solicitada_por  uuid        NOT NULL REFERENCES perfis(id),
  modelo          text        NOT NULL,
  tokens_entrada  integer     NOT NULL DEFAULT 0,
  tokens_saida    integer     NOT NULL DEFAULT 0,
  texto_enviado   text        NOT NULL,
  mapa            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  resultado       jsonb       NOT NULL,
  decisao         text        NOT NULL DEFAULT 'pendente' CHECK (decisao IN ('pendente', 'aprovada', 'reprovada')),
  decidida_por    uuid        REFERENCES perfis(id),
  decidida_em     timestamptz,
  motivo          text
);

CREATE INDEX IF NOT EXISTS idx_ocorrencia_analises_ia_ocorrencia
  ON ocorrencia_analises_ia(ocorrencia_id, created_at DESC);

ALTER TABLE ocorrencia_analises_ia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ocorrencia_analises_ia_admin_all ON ocorrencia_analises_ia;
CREATE POLICY ocorrencia_analises_ia_admin_all ON ocorrencia_analises_ia
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- supervisor e viewer: sem policy = sem acesso
