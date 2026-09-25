-- ============================================================
-- Devolutiva por ocorrência: conversa RH <-> supervisor.
-- Mensagens não são editadas nem apagadas (registro de RH, auditável):
-- por isso só existem policies de SELECT e INSERT (mais admin_all).
-- ============================================================

CREATE TABLE ocorrencia_comentarios (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  ocorrencia_id uuid        NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
  autor_id      uuid        NOT NULL REFERENCES perfis(id),
  texto         text        NOT NULL CHECK (length(btrim(texto)) > 0),
  tipo          text        NOT NULL DEFAULT 'mensagem' CHECK (tipo IN ('mensagem', 'parecer'))
);

CREATE INDEX idx_ocorrencia_comentarios_ocorrencia
  ON ocorrencia_comentarios(ocorrencia_id, created_at);

ALTER TABLE ocorrencia_comentarios ENABLE ROW LEVEL SECURITY;

-- admin/coordenador: acesso total
CREATE POLICY ocorrencia_comentarios_admin_all ON ocorrencia_comentarios
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- supervisor: lê a conversa das ocorrências do seu posto
CREATE POLICY ocorrencia_comentarios_supervisor_select ON ocorrencia_comentarios
  FOR SELECT TO authenticated
  USING (
    is_supervisor()
    AND EXISTS (
      SELECT 1 FROM ocorrencias o
      WHERE o.id = ocorrencia_id
        AND o.tipo = 'ocorrencia'
        AND (
          o.posto_id IN (SELECT get_supervisor_posto_ids())
          OR o.funcionario_id IN (
            SELECT id FROM funcionarios
            WHERE posto_id IN (SELECT get_supervisor_posto_ids())
          )
        )
    )
  );

-- supervisor: escreve na conversa das ocorrências do seu posto, sempre como ele mesmo.
-- Só 'mensagem': o 'parecer' nasce junto com o encerramento, via Server Action (admin client),
-- então não pode ser forjado direto pela API.
CREATE POLICY ocorrencia_comentarios_supervisor_insert ON ocorrencia_comentarios
  FOR INSERT TO authenticated
  WITH CHECK (
    is_supervisor()
    AND autor_id = auth.uid()
    AND tipo = 'mensagem'
    AND EXISTS (
      SELECT 1 FROM ocorrencias o
      WHERE o.id = ocorrencia_id
        AND o.tipo = 'ocorrencia'
        AND (
          o.posto_id IN (SELECT get_supervisor_posto_ids())
          OR o.funcionario_id IN (
            SELECT id FROM funcionarios
            WHERE posto_id IN (SELECT get_supervisor_posto_ids())
          )
        )
    )
  );

-- viewer: sem policy = sem acesso (a conversa é um canal privado RH <-> supervisor)
