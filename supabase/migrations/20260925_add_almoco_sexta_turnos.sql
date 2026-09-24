-- Pausa (almoço/janta) própria da sexta, no regime 5x1/6x1.
-- Até aqui a sexta reaproveitava o almoço de segunda a quinta (hora_inicio_almoco/hora_fim_almoco),
-- o que não serve quando a sexta tem outra jornada e a pausa cai em outro horário
-- (caso do CRESCER CENTRO: segunda a quinta 13:00-22:00 com janta às 18:00, sexta 09:00-17:00 com pausa às 12:00).
-- Nullable: null = sexta segue o almoço do dia de semana (comportamento atual de todo turno existente).
alter table turnos_postos
  add column if not exists hora_inicio_almoco_sex time,
  add column if not exists hora_fim_almoco_sex time;
