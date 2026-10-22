-- Encaminhamento do atestado ao ambulatório: guarda quando e por quem o arquivo foi enviado por e-mail.
-- O arquivo em si não é guardado.
ALTER TABLE atestados
  ADD COLUMN IF NOT EXISTS ambulatorio_enviado_em  timestamptz,
  ADD COLUMN IF NOT EXISTS ambulatorio_enviado_por uuid REFERENCES perfis(id);
