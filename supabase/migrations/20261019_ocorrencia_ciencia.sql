-- Gestão dá "ciente" em ocorrência irrelevante: sai da lista de pendências da gestão
-- sem precisar responder. Volta a pendente se o supervisor escrever de novo.
ALTER TABLE ocorrencias
  ADD COLUMN IF NOT EXISTS ciencia_gestao_em  timestamptz,
  ADD COLUMN IF NOT EXISTS ciencia_gestao_por uuid REFERENCES perfis(id);
