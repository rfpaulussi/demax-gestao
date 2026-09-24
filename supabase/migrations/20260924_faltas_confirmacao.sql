-- Confirmação de faltas injustificadas pelo supervisor (evita dupla penalização com atestado tardio)
ALTER TABLE faltas ADD COLUMN IF NOT EXISTS confirmada_em  timestamptz;
ALTER TABLE faltas ADD COLUMN IF NOT EXISTS confirmada_por uuid REFERENCES perfis(id);

-- Faltas já existentes são consideradas resolvidas (não inundar a faixa de pendências)
UPDATE faltas SET confirmada_em = now() WHERE confirmada_em IS NULL;
