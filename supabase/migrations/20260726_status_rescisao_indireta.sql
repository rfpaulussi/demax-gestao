-- Adiciona status 'rescisao_indireta' na tabela funcionarios
-- Rescisao_indireta = funcionario avisou que entrou com acao de rescisao
-- indireta (Art. 483 CLT) e parou de trabalhar; aguardando audiencia
-- confirmar o desligamento. Sai da contagem de Ativos, mas so vira
-- 'desligado' quando a audiencia confirmar (fluxo separado).

ALTER TABLE funcionarios
  DROP CONSTRAINT IF EXISTS funcionarios_status_check;

ALTER TABLE funcionarios
  ADD CONSTRAINT funcionarios_status_check
  CHECK (status IN ('ativo', 'atestado', 'afastado', 'ferias', 'desligado', 'faltante', 'rescisao_indireta'));
