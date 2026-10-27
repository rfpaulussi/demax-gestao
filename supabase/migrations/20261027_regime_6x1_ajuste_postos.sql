-- Regime 6x1 passa a existir separado do 5x1 (5 dias + 1 folga) e ajusta os postos conforme planilha do RH (27/10/2026).
-- Valor '5x1' continua sendo 5 dias de trabalho + 1 folga; '6x1' = segunda a sábado (era o '5x1 (6x1)' antigo).
-- NÃO rodar sem aprovação: altera config_escalas_postos e turnos_postos.

BEGIN;

-- 1) Postos 6x1: config + todos os turnos viram 6x1 (inclui o turno 5x2 do Mercado do Produtor, que tem 2 funcionários)
UPDATE turnos_postos SET tipo_escala = '6x1'
WHERE posto_id IN (SELECT id FROM postos WHERE nome IN (
  'COI CENTRO DE OPERAÇÕES INTEGRADAS', 'CEMITÉRIO SÃO SALVADOR', 'CRESCER CENTRO',
  'GCM - PRAÇA DO RELÓGIO', 'MERCADO DO PRODUTOR MINOR HARADA', 'PIT STOP'))
  AND tipo_escala IN ('5x1', '5x2');

INSERT INTO config_escalas_postos (posto_id, regime)
SELECT id, '6x1' FROM postos WHERE nome IN (
  'COI CENTRO DE OPERAÇÕES INTEGRADAS', 'CEMITÉRIO SÃO SALVADOR', 'CRESCER CENTRO',
  'GCM - PRAÇA DO RELÓGIO', 'MERCADO DO PRODUTOR MINOR HARADA', 'PIT STOP')
ON CONFLICT (posto_id) DO UPDATE SET regime = '6x1', updated_at = now();

-- 2) Postos 5x1 (5 dias + 1 folga): Parque da Cidade, Leon Feffer, Terminal Central, Terminal Estudantes, Parque Airton Nogueira
INSERT INTO config_escalas_postos (posto_id, regime)
SELECT id, '5x1' FROM postos WHERE nome IN (
  'PARQUE DA CIDADE', 'PARQUE LEON FEFFER', 'TERMINAL CENTRAL', 'TERMINAL ESTUDANTES', 'PARQUE AIRTON NOGUEIRA')
ON CONFLICT (posto_id) DO UPDATE SET regime = '5x1', updated_at = now();

-- 2a) Terminal Estudantes: turnos 5x2 com funcionário viram 5x1 (mantém horário); turnos sem funcionário vigente saem
UPDATE turnos_postos SET tipo_escala = '5x1'
WHERE posto_id = (SELECT id FROM postos WHERE nome = 'TERMINAL ESTUDANTES')
  AND tipo_escala = '5x2'
  AND EXISTS (SELECT 1 FROM horarios_funcionarios h WHERE h.turno_id = turnos_postos.id AND h.data_fim IS NULL);

-- sem vínculo nenhum: exclui; com histórico de vínculo: só desativa
DELETE FROM turnos_postos t
WHERE t.posto_id IN (SELECT id FROM postos WHERE nome IN ('PARQUE LEON FEFFER', 'TERMINAL ESTUDANTES'))
  AND t.tipo_escala = '5x2'
  AND NOT EXISTS (SELECT 1 FROM horarios_funcionarios h WHERE h.turno_id = t.id);

UPDATE turnos_postos t SET ativo = false
WHERE t.posto_id IN (SELECT id FROM postos WHERE nome IN ('PARQUE LEON FEFFER', 'TERMINAL ESTUDANTES'))
  AND t.tipo_escala = '5x2'
  AND NOT EXISTS (SELECT 1 FROM horarios_funcionarios h WHERE h.turno_id = t.id AND h.data_fim IS NULL);

-- Terminal Estudantes: 'Turno 6h' 5x1 sem funcionário vigente
UPDATE turnos_postos t SET ativo = false
WHERE t.posto_id = (SELECT id FROM postos WHERE nome = 'TERMINAL ESTUDANTES')
  AND t.nome = 'Turno 6h' AND t.tipo_escala = '5x1'
  AND NOT EXISTS (SELECT 1 FROM horarios_funcionarios h WHERE h.turno_id = t.id AND h.data_fim IS NULL);

-- 3) Ginásios Hugo Ramos e Tuta: 5x2, 07:00–12:00 / 13:00–16:48 (sexta igual)
UPDATE turnos_postos SET
  tipo_escala = '5x2',
  hora_entrada = '07:00', hora_inicio_almoco = '12:00', hora_fim_almoco = '13:00',
  hora_saida_seg_qui = '16:48', hora_saida_sex = '16:48',
  hora_entrada_sex = NULL, hora_inicio_almoco_sex = NULL, hora_fim_almoco_sex = NULL,
  hora_entrada_sabado = NULL, hora_inicio_almoco_sabado = NULL, hora_fim_almoco_sabado = NULL, hora_saida_sabado = NULL
WHERE posto_id IN (SELECT id FROM postos WHERE nome IN ('GINÁSIO HUGO RAMOS', 'GINÁSIO TUTA'));

INSERT INTO config_escalas_postos (posto_id, regime)
SELECT id, '5x2' FROM postos WHERE nome IN ('GINÁSIO HUGO RAMOS', 'GINÁSIO TUTA')
ON CONFLICT (posto_id) DO UPDATE SET regime = '5x2', updated_at = now();

-- 4) Demais postos sem regime configurado passam a ter 5x2 explícito (já era o padrão do sistema)
INSERT INTO config_escalas_postos (posto_id, regime)
SELECT p.id, '5x2' FROM postos p
WHERE p.nome NOT LIKE 'AFASTADO - %' AND p.nome <> 'UBS NOVA MOGI'
  AND NOT EXISTS (SELECT 1 FROM config_escalas_postos c WHERE c.posto_id = p.id);

COMMIT;
