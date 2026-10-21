-- Campos vindos da listagem de limite de férias do RH (carga a cada ~2 meses)

ALTER TABLE ferias
  ADD COLUMN IF NOT EXISTS dias_falta       numeric(5,1),
  ADD COLUMN IF NOT EXISTS dias_afastado    numeric(5,1),
  ADD COLUMN IF NOT EXISTS obs_rh           text,
  ADD COLUMN IF NOT EXISTS rh_atualizado_em date;

COMMENT ON COLUMN ferias.dias_falta       IS 'Dias de falta no período aquisitivo, conforme listagem do RH';
COMMENT ON COLUMN ferias.dias_afastado    IS 'Dias de afastamento no período aquisitivo, conforme listagem do RH';
COMMENT ON COLUMN ferias.obs_rh           IS 'Observação da listagem do RH (ex.: PROC TRAB)';
COMMENT ON COLUMN ferias.rh_atualizado_em IS 'Data da última listagem do RH que atualizou este período';

ALTER TABLE funcionarios
  ADD COLUMN IF NOT EXISTS centro_custo text;

COMMENT ON COLUMN funcionarios.centro_custo IS 'Centro de custo do RH (varia por funcionário dentro do mesmo posto)';
