-- Turnos globais de jovem aprendiz (sem posto): além de Manhã (08-12) e Tarde (13-17) já existentes,
-- adiciona as demais janelas de 4h usadas pelos postos. Idempotente.
INSERT INTO turnos_postos (posto_id, nome, tipo_escala, hora_entrada, hora_saida_seg_qui, hora_saida_sex, hora_inicio_almoco, hora_fim_almoco, ativo)
SELECT NULL, v.nome, 'jovem_aprendiz', v.entrada::time, v.saida::time, NULL, NULL, NULL, true
FROM (VALUES
  ('Jovem Aprendiz 07:00 às 11:00', '07:00', '11:00'),
  ('Jovem Aprendiz 09:00 às 13:00', '09:00', '13:00'),
  ('Jovem Aprendiz 11:00 às 15:00', '11:00', '15:00'),
  ('Jovem Aprendiz 12:00 às 16:00', '12:00', '16:00'),
  ('Jovem Aprendiz 13:30 às 17:30', '13:30', '17:30'),
  ('Jovem Aprendiz 14:00 às 18:00', '14:00', '18:00')
) AS v(nome, entrada, saida)
WHERE NOT EXISTS (
  SELECT 1 FROM turnos_postos t WHERE t.posto_id IS NULL AND t.nome = v.nome
);
