-- Suporte a horário de sábado diferente do dia de semana (necessário pro regime 5x1/6x1
-- quando o turno do posto tem entrada/almoço/saída próprios aos sábados, não apenas uma
-- variação de saída como já existe pra sexta no 5x2 via hora_saida_sex).
-- Nullable: null = sábado segue o mesmo horário do dia de semana (comportamento atual
-- de todo turno 5x1/12x36 existente, preservado sem qualquer migração de dado).
alter table turnos_postos
  add column if not exists hora_entrada_sabado time,
  add column if not exists hora_inicio_almoco_sabado time,
  add column if not exists hora_fim_almoco_sabado time,
  add column if not exists hora_saida_sabado time;

-- Sexta com ENTRADA diferente do dia de semana (não só a saída, que já existia via
-- hora_saida_sex). Necessário quando o turno é de revezamento e a sexta encurta por
-- baixo (entra depois), não por cima (sai antes) — caso do turno Tarde do CRESCER CENTRO.
-- Nullable: null = sexta usa a mesma entrada do dia de semana (comportamento atual
-- preservado pra todo turno existente, incluindo os 5x2 que já usam hora_saida_sex).
alter table turnos_postos
  add column if not exists hora_entrada_sex time;
