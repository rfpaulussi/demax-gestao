-- supabase/migrations/20260711_jovem_aprendiz_regime.sql
ALTER TABLE turnos_postos ALTER COLUMN posto_id DROP NOT NULL;

ALTER TABLE horarios_funcionarios ADD COLUMN IF NOT EXISTS dia_curso SMALLINT;
ALTER TABLE horarios_funcionarios DROP CONSTRAINT IF EXISTS dia_curso_range;
ALTER TABLE horarios_funcionarios ADD CONSTRAINT dia_curso_range CHECK (dia_curso IS NULL OR dia_curso BETWEEN 1 AND 5);

INSERT INTO turnos_postos (posto_id, nome, tipo_escala, hora_entrada, hora_saida_seg_qui, hora_saida_sex, hora_inicio_almoco, hora_fim_almoco, ativo)
SELECT NULL, 'Jovem Aprendiz Manhã', 'jovem_aprendiz', '07:00', '11:00', NULL, NULL, NULL, true
WHERE NOT EXISTS (SELECT 1 FROM turnos_postos WHERE posto_id IS NULL AND nome = 'Jovem Aprendiz Manhã');

INSERT INTO turnos_postos (posto_id, nome, tipo_escala, hora_entrada, hora_saida_seg_qui, hora_saida_sex, hora_inicio_almoco, hora_fim_almoco, ativo)
SELECT NULL, 'Jovem Aprendiz Tarde', 'jovem_aprendiz', '13:00', '17:00', NULL, NULL, NULL, true
WHERE NOT EXISTS (SELECT 1 FROM turnos_postos WHERE posto_id IS NULL AND nome = 'Jovem Aprendiz Tarde');
