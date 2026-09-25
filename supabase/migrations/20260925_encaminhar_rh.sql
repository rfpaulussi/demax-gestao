-- ============================================================
-- Encaminhar ocorrência ao RH (fluxo do coordenador).
-- - ocorrencias.com_rh_desde / com_rh_por: "está com o RH".
-- - ocorrencia_comentarios.tipo ganha 'nota_interna': só admin/coordenador vê.
--   O supervisor nunca lê esse tipo (RLS abaixo + filtro no servidor).
-- ============================================================

ALTER TABLE ocorrencias
  ADD COLUMN IF NOT EXISTS com_rh_desde timestamptz,
  ADD COLUMN IF NOT EXISTS com_rh_por   uuid REFERENCES perfis(id);

ALTER TABLE ocorrencia_comentarios
  DROP CONSTRAINT IF EXISTS ocorrencia_comentarios_tipo_check;
ALTER TABLE ocorrencia_comentarios
  ADD CONSTRAINT ocorrencia_comentarios_tipo_check
  CHECK (tipo IN ('mensagem', 'parecer', 'nota_interna'));

-- supervisor: lê a conversa das ocorrências do seu posto, MENOS as notas internas
DROP POLICY IF EXISTS ocorrencia_comentarios_supervisor_select ON ocorrencia_comentarios;
CREATE POLICY ocorrencia_comentarios_supervisor_select ON ocorrencia_comentarios
  FOR SELECT TO authenticated
  USING (
    is_supervisor()
    AND tipo <> 'nota_interna'
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
-- A policy de INSERT do supervisor continua só tipo = 'mensagem' (não mexe).
