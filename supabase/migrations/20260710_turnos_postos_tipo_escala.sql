-- supabase/migrations/20260710_turnos_postos_tipo_escala.sql
ALTER TABLE turnos_postos ADD COLUMN IF NOT EXISTS tipo_escala TEXT;

ALTER TABLE turnos_postos ALTER COLUMN hora_saida_sex DROP NOT NULL;
ALTER TABLE turnos_postos ALTER COLUMN hora_inicio_almoco DROP NOT NULL;
ALTER TABLE turnos_postos ALTER COLUMN hora_fim_almoco DROP NOT NULL;

UPDATE turnos_postos SET tipo_escala = '5x2' WHERE tipo_escala IS NULL;

ALTER TABLE turnos_postos ALTER COLUMN tipo_escala SET NOT NULL;
ALTER TABLE turnos_postos ALTER COLUMN tipo_escala SET DEFAULT '5x2';
