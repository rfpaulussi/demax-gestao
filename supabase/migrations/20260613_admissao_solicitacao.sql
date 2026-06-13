-- ============================================================
-- Fluxo de Admissão via Solicitação
-- ============================================================

-- 1. Novas colunas em funcionarios
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS registro TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS criado_via TEXT;

-- 2. Tornar funcionario_id nullable em solicitacoes
--    (admissão não tem funcionario pré-existente)
ALTER TABLE solicitacoes ALTER COLUMN funcionario_id DROP NOT NULL;

-- 3. Atualizar CHECK constraint de tipo para incluir 'admissao'
--    Encontra e descarta a constraint atual (nome pode variar por ambiente)
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
    'retorno_afastamento','rescisao_indireta','admissao'
  ]));

-- Verificação: exibir constraint aplicada
SELECT conname, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conrelid = 'solicitacoes'::regclass AND contype = 'c';
