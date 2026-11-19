-- ============================================================
-- Ocorrência encaminhada ao RH COM aviso ao supervisor.
-- ocorrencias.rh_informado_supervisor_em: quando a gestão encaminhou ao RH escolhendo
-- avisar o supervisor ("Aprovar e encaminhar ao RH"). Só com essa marca o supervisor
-- enxerga o selo "Encaminhada ao RH". "Só encaminhar ao RH" não grava nada aqui.
-- O selo vale enquanto a ocorrência está com o RH (com_rh_desde não nulo).
-- ============================================================

ALTER TABLE ocorrencias
  ADD COLUMN IF NOT EXISTS rh_informado_supervisor_em timestamptz;
