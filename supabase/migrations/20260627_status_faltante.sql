-- Adiciona status 'faltante' na tabela funcionarios
-- Faltante = ausência de 3+ dias sem atestado médico; sai do efetivo e gera alerta de descoberto

ALTER TABLE funcionarios
  DROP CONSTRAINT IF EXISTS funcionarios_status_check;

ALTER TABLE funcionarios
  ADD CONSTRAINT funcionarios_status_check
  CHECK (status IN ('ativo', 'atestado', 'afastado', 'ferias', 'desligado', 'faltante'));
