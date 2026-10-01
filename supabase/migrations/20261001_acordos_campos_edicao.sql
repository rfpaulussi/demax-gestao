-- Acordos de compensação: guarda o formulário preenchido (para reabrir e editar) e quem/quando editou.
-- Aditiva: nenhuma coluna ou dado existente é alterado. Aplicar no Supabase Studio (SQL Editor).
-- Sem esta migration o sistema continua funcionando: acordos novos só não guardam o formulário
-- (e o "Editar" reconstrói o que dá a partir das colunas e dos movimentos).

ALTER TABLE acordos_compensacao
  ADD COLUMN IF NOT EXISTS campos jsonb,
  ADD COLUMN IF NOT EXISTS editado_em timestamptz,
  ADD COLUMN IF NOT EXISTS editado_por uuid;
