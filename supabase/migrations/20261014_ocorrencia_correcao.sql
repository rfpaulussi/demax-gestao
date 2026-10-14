-- Gestão libera a ocorrência para o supervisor corrigir a redação antes da análise.
-- correcao_liberada_em preenchido = aguardando correção do supervisor (análise por IA e
-- encaminhamento ao RH ficam bloqueados até ele corrigir).
ALTER TABLE ocorrencias
  ADD COLUMN IF NOT EXISTS correcao_liberada_em  timestamptz,
  ADD COLUMN IF NOT EXISTS correcao_liberada_por uuid REFERENCES perfis(id),
  ADD COLUMN IF NOT EXISTS correcao_motivo       text;
