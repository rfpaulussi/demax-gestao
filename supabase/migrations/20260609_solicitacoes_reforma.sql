-- supabase/migrations/20260609_solicitacoes_reforma.sql

-- 1. Adicionar salário individual em funcionarios
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS salario NUMERIC(10,2);

-- 2. Adicionar campos de controle em solicitacoes
ALTER TABLE solicitacoes
  ADD COLUMN IF NOT EXISTS vigencia DATE,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao TEXT;

-- 3. Deprecar solicitações pendentes do tipo removido
UPDATE solicitacoes
SET status = 'rejeitada',
    observacao_admin = 'Tipo removido do sistema'
WHERE tipo = 'mudanca_supervisor'
  AND status = 'pendente';

-- 4. Recriar CHECK de tipo (remover mudanca_supervisor, adicionar alteracao_salario)
ALTER TABLE solicitacoes DROP CONSTRAINT IF EXISTS solicitacoes_tipo_check;
ALTER TABLE solicitacoes ADD CONSTRAINT solicitacoes_tipo_check
  CHECK (tipo IN (
    'transferencia',
    'mudanca_funcao',
    'promocao',
    'desligamento',
    'alteracao_salario'
  ));
