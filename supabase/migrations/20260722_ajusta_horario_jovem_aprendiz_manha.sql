-- supabase/migrations/20260722_ajusta_horario_jovem_aprendiz_manha.sql
-- Corrige o horario do turno global "Jovem Aprendiz Manha", que havia sido semeado como 07:00-11:00.
UPDATE turnos_postos
SET hora_entrada = '08:00', hora_saida_seg_qui = '12:00'
WHERE posto_id IS NULL AND nome = 'Jovem Aprendiz Manhã' AND tipo_escala = 'jovem_aprendiz';
