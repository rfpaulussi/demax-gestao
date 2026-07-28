-- ============================================================
-- Solicitação de mudança de horário (turno) dentro do mesmo posto
-- ============================================================

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'solicitacoes'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%desligamento%'
  LOOP
    EXECUTE format('ALTER TABLE solicitacoes DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE solicitacoes ADD CONSTRAINT solicitacoes_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'desligamento','transferencia','mudanca_funcao','promocao',
    'mudanca_supervisor','alteracao_salario','afastamento',
    'retorno_afastamento','rescisao_indireta','admissao','mudanca_horario'
  ]));

-- Verificação: exibir constraint aplicada
SELECT conname, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conrelid = 'solicitacoes'::regclass AND contype = 'c';
