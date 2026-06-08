-- Migration: Adiciona colunas CLT à tabela advertencias
-- Executar no SQL Editor do Supabase

ALTER TABLE advertencias
  ADD COLUMN IF NOT EXISTS grau text,
  ADD COLUMN IF NOT EXISTS horario_fato text,
  ADD COLUMN IF NOT EXISTS natureza text,
  ADD COLUMN IF NOT EXISTS relato text,
  ADD COLUMN IF NOT EXISTS testemunha_1 text,
  ADD COLUMN IF NOT EXISTS testemunha_2 text,
  ADD COLUMN IF NOT EXISTS defesa_colaborador text,
  ADD COLUMN IF NOT EXISTS dias_suspensao integer,
  ADD COLUMN IF NOT EXISTS data_aplicacao date,
  ADD COLUMN IF NOT EXISTS registrado_por text;

-- Backfill grau a partir do tipo para registros existentes
UPDATE advertencias
  SET grau = tipo
  WHERE tipo IN ('verbal', 'escrita', 'suspensao')
    AND grau IS NULL;
