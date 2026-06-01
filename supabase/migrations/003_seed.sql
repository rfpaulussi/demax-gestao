-- ============================================================
-- 003_seed.sql — Demax Gestão — Dados iniciais
-- ============================================================

-- ============================================================
-- FUNÇÕES (13 registros)
-- Valores de insalubridade/periculosidade zerados quando não
-- aplicável ao cargo (não NULL, pois o campo é sempre exibido).
-- ============================================================
INSERT INTO funcoes (id, nome, insalubridade_perc, periculosidade_perc, salario_base, insalubridade_valor, periculosidade_valor) VALUES
  (gen_random_uuid(), 'AGENTE DE HIGIENIZAÇÃO A',        40, 0, 1837.40, 648.40,   0.00),
  (gen_random_uuid(), 'AGENTE DE HIGIENIZAÇÃO B',        40, 0, 1837.40, 648.40,   0.00),
  (gen_random_uuid(), 'AGENTE DE HIGIENIZAÇÃO C',        40, 0, 1837.40, 648.40,   0.00),
  (gen_random_uuid(), 'AJUDANTE DE LIMPEZA',              0, 0, 1837.40,   0.00,   0.00),
  (gen_random_uuid(), 'AUXILIAR ADMINISTRATIVO_01',       0, 0, 3489.80,   0.00,   0.00),
  (gen_random_uuid(), 'AUXILIAR ADMINISTRATIVO_02',       0, 0, 1837.40,   0.00,   0.00),
  (gen_random_uuid(), 'ENCARREGADO (A)_01',               0, 0, 2404.68,   0.00,   0.00),
  (gen_random_uuid(), 'ENCARREGADO (A)_02',               0, 0, 3433.87,   0.00,   0.00),
  (gen_random_uuid(), 'ENCARREGADO (A)_03',              40, 0, 2404.68, 648.40,   0.00),
  (gen_random_uuid(), 'LIMPADOR (A) DE VIDROS',           0, 30, 2014.10,   0.00, 604.23),
  (gen_random_uuid(), 'SUPERVISOR (A) DE SERVIÇOS_01',    0, 0, 4181.10,   0.00,   0.00),
  (gen_random_uuid(), 'SUPERVISOR (A) DE SERVIÇOS_02',    0, 0, 4982.00,   0.00,   0.00),
  (gen_random_uuid(), 'SUPERVISOR (A) DE SERVIÇOS_03',    0, 0, 5755.52,   0.00,   0.00);

-- ============================================================
-- CUSTOS POR FUNÇÃO (13 registros)
-- Subquery por nome para resolver o funcao_id dinamicamente.
-- ============================================================
INSERT INTO custos_funcoes (funcao_id, enc_inss, fgts, va, assid_asseio, vr, vt, bss, aux_saude, plr, um_doze_decimo_terceiro, um_terceiro_ferias, enc_provisorio, um_doze_lei_12506, multa_40_pct, total_por_func)
SELECT id, 719.91, 198.86, 151.98, 315.00, 436.00, 212.00, 16.75, 37.09, 29.70, 207.15, 94.57, 111.52, 15.31, 89.69, 5121.33
FROM funcoes WHERE nome = 'AGENTE DE HIGIENIZAÇÃO A';

INSERT INTO custos_funcoes (funcao_id, enc_inss, fgts, va, assid_asseio, vr, vt, bss, aux_saude, plr, um_doze_decimo_terceiro, um_terceiro_ferias, enc_provisorio, um_doze_lei_12506, multa_40_pct, total_por_func)
SELECT id, 719.91, 198.86, 151.98, 315.00, 436.00, 212.00, 16.75, 37.09, 29.70, 207.15, 94.57, 111.52, 15.31, 89.69, 5121.33
FROM funcoes WHERE nome = 'AGENTE DE HIGIENIZAÇÃO B';

INSERT INTO custos_funcoes (funcao_id, enc_inss, fgts, va, assid_asseio, vr, vt, bss, aux_saude, plr, um_doze_decimo_terceiro, um_terceiro_ferias, enc_provisorio, um_doze_lei_12506, multa_40_pct, total_por_func)
SELECT id, 719.91, 198.86, 151.98, 315.00, 436.00, 212.00, 16.75, 37.09, 29.70, 207.15, 94.57, 111.52, 15.31, 89.69, 5121.33
FROM funcoes WHERE nome = 'AGENTE DE HIGIENIZAÇÃO C';

INSERT INTO custos_funcoes (funcao_id, enc_inss, fgts, va, assid_asseio, vr, vt, bss, aux_saude, plr, um_doze_decimo_terceiro, um_terceiro_ferias, enc_provisorio, um_doze_lei_12506, multa_40_pct, total_por_func)
SELECT id, 532.13, 146.99, 151.98, 315.00, 436.00, 212.00, 16.75, 37.09, 29.70, 153.12, 69.90, 82.43, 15.31, 66.42, 4102.22
FROM funcoes WHERE nome = 'AJUDANTE DE LIMPEZA';

INSERT INTO custos_funcoes (funcao_id, enc_inss, fgts, va, assid_asseio, vr, vt, bss, aux_saude, plr, um_doze_decimo_terceiro, um_terceiro_ferias, enc_provisorio, um_doze_lei_12506, multa_40_pct, total_por_func)
SELECT id, 1010.67, 279.18, 180.00, 0.00, 800.00, 0.00, 16.75, 37.09, 0.00, 290.82, 132.77, 156.56, 29.08, 126.16, 6548.88
FROM funcoes WHERE nome = 'AUXILIAR ADMINISTRATIVO_01';

INSERT INTO custos_funcoes (funcao_id, enc_inss, fgts, va, assid_asseio, vr, vt, bss, aux_saude, plr, um_doze_decimo_terceiro, um_terceiro_ferias, enc_provisorio, um_doze_lei_12506, multa_40_pct, total_por_func)
SELECT id, 532.13, 146.99, 151.98, 315.00, 436.00, 0.00, 16.75, 37.09, 29.70, 153.12, 69.90, 82.43, 15.31, 66.42, 3890.22
FROM funcoes WHERE nome = 'AUXILIAR ADMINISTRATIVO_02';

INSERT INTO custos_funcoes (funcao_id, enc_inss, fgts, va, assid_asseio, vr, vt, bss, aux_saude, plr, um_doze_decimo_terceiro, um_terceiro_ferias, enc_provisorio, um_doze_lei_12506, multa_40_pct, total_por_func)
SELECT id, 696.41, 192.37, 151.98, 315.00, 436.00, 212.00, 16.75, 37.09, 29.70, 200.39, 91.49, 107.88, 20.04, 86.93, 4998.71
FROM funcoes WHERE nome = 'ENCARREGADO (A)_01';

INSERT INTO custos_funcoes (funcao_id, enc_inss, fgts, va, assid_asseio, vr, vt, bss, aux_saude, plr, um_doze_decimo_terceiro, um_terceiro_ferias, enc_provisorio, um_doze_lei_12506, multa_40_pct, total_por_func)
SELECT id, 994.48, 274.71, 180.00, 200.00, 800.00, 0.00, 16.75, 37.09, 29.70, 286.16, 130.64, 154.05, 28.62, 124.14, 6690.20
FROM funcoes WHERE nome = 'ENCARREGADO (A)_02';

INSERT INTO custos_funcoes (funcao_id, enc_inss, fgts, va, assid_asseio, vr, vt, bss, aux_saude, plr, um_doze_decimo_terceiro, um_terceiro_ferias, enc_provisorio, um_doze_lei_12506, multa_40_pct, total_por_func)
SELECT id, 884.20, 244.25, 151.98, 315.00, 436.00, 212.00, 16.75, 37.09, 29.70, 254.42, 116.15, 136.97, 20.04, 110.20, 6017.82
FROM funcoes WHERE nome = 'ENCARREGADO (A)_03';

INSERT INTO custos_funcoes (funcao_id, enc_inss, fgts, va, assid_asseio, vr, vt, bss, aux_saude, plr, um_doze_decimo_terceiro, um_terceiro_ferias, enc_provisorio, um_doze_lei_12506, multa_40_pct, total_por_func)
SELECT id, 758.29, 209.47, 151.98, 315.00, 436.00, 212.00, 16.75, 37.09, 29.70, 218.19, 99.61, 117.46, 16.78, 94.49, 5331.16
FROM funcoes WHERE nome = 'LIMPADOR (A) DE VIDROS';

INSERT INTO custos_funcoes (funcao_id, enc_inss, fgts, va, assid_asseio, vr, vt, bss, aux_saude, plr, um_doze_decimo_terceiro, um_terceiro_ferias, enc_provisorio, um_doze_lei_12506, multa_40_pct, total_por_func)
SELECT id, 1210.88, 334.49, 180.00, 0.00, 800.00, 0.00, 16.75, 37.09, 0.00, 348.43, 159.07, 187.57, 34.84, 151.15, 7641.37
FROM funcoes WHERE nome = 'SUPERVISOR (A) DE SERVIÇOS_01';

INSERT INTO custos_funcoes (funcao_id, enc_inss, fgts, va, assid_asseio, vr, vt, bss, aux_saude, plr, um_doze_decimo_terceiro, um_terceiro_ferias, enc_provisorio, um_doze_lei_12506, multa_40_pct, total_por_func)
SELECT id, 1442.83, 398.56, 180.00, 0.00, 800.00, 0.00, 16.75, 37.09, 0.00, 415.17, 189.54, 223.50, 41.52, 180.10, 8907.06
FROM funcoes WHERE nome = 'SUPERVISOR (A) DE SERVIÇOS_02';

INSERT INTO custos_funcoes (funcao_id, enc_inss, fgts, va, assid_asseio, vr, vt, bss, aux_saude, plr, um_doze_decimo_terceiro, um_terceiro_ferias, enc_provisorio, um_doze_lei_12506, multa_40_pct, total_por_func)
SELECT id, 1666.84, 460.44, 180.00, 0.00, 800.00, 0.00, 0.00, 0.00, 0.00, 479.63, 218.97, 258.21, 47.96, 208.07, 10075.63
FROM funcoes WHERE nome = 'SUPERVISOR (A) DE SERVIÇOS_03';

-- ============================================================
-- POSTOS (213 registros)
-- contrato_id = NULL — contratos ainda não cadastrados nesta fase.
-- Ordem: secretaria crescente, mantendo a sequência original.
-- ============================================================
INSERT INTO postos (id, contrato_id, nome, secretaria, efetivo_previsto, cota_insalubridade) VALUES
-- SEDE
  (gen_random_uuid(), NULL, 'SEDE', 'SEDE', 12, 0),
-- SEMAS
  (gen_random_uuid(), NULL, 'CRAS VILA NOVA UNIÃO', 'SEMAS', 1, 1),
  (gen_random_uuid(), NULL, 'CRAS JUNDIAPEBA II', 'SEMAS', 1, 1),
  (gen_random_uuid(), NULL, 'CREAS BRAZ CUBAS', 'SEMAS', 1, 1),
  (gen_random_uuid(), NULL, 'SECRETARIA DE ASSISTÊNCIA SOCIAL - PRÉDIO II PMMC', 'SEMAS', 1, 1),
  (gen_random_uuid(), NULL, 'CRAS JARDIM LAYR', 'SEMAS', 1, 1),
  (gen_random_uuid(), NULL, 'CRAS VILA BRASILEIRA', 'SEMAS', 1, 1),
  (gen_random_uuid(), NULL, 'VILA DIGNIDADE', 'SEMAS', 1, 1),
  (gen_random_uuid(), NULL, 'CIC JUNDIAPEBA', 'SEMAS', 2, 2),
  (gen_random_uuid(), NULL, 'CENTRO POP', 'SEMAS', 2, 2),
  (gen_random_uuid(), NULL, 'CONSELHO TUTELAR DE JUNDIAPEBA / BRÁS CUBAS / CENTRO', 'SEMAS', 2, 2),
-- SMAPA
  (gen_random_uuid(), NULL, 'ILHA MARABÁ', 'SMAPA', 2, 0),
  (gen_random_uuid(), NULL, 'PARQUE LEON FEFFER', 'SMAPA', 2, 2),
  (gen_random_uuid(), NULL, 'NUBEA', 'SMAPA', 2, 2),
  (gen_random_uuid(), NULL, 'PARQUE CENTENÁRIO', 'SMAPA', 4, 4),
-- SMASA
  (gen_random_uuid(), NULL, 'MERCADO DO PRODUTOR MINOR HARADA', 'SMASA', 5, 5),
-- SMC
  (gen_random_uuid(), NULL, 'ARQUIVO HISTÓRICO / PINACOTECA', 'SMC', 1, 1),
  (gen_random_uuid(), NULL, 'CASARÃO', 'SMC', 1, 1),
  (gen_random_uuid(), NULL, 'CENTRO DE CULTURA E MEMÓRIA EXPEDICIONÁRIOS MOGIANOS / EMAM', 'SMC', 1, 1),
  (gen_random_uuid(), NULL, 'MUSEU TARO KONNO', 'SMC', 1, 1),
  (gen_random_uuid(), NULL, 'TEATRO VASQUES', 'SMC', 1, 1),
  (gen_random_uuid(), NULL, 'CIARTE', 'SMC', 1, 1),
  (gen_random_uuid(), NULL, 'CENTRO DE ARTE, ESPORTE E DESENVOLVIMENTO - CAED', 'SMC', 1, 1),
  (gen_random_uuid(), NULL, 'CENTRO CULTURAL / CASA DO HIP HOP', 'SMC', 2, 2),
-- SMDET
  (gen_random_uuid(), NULL, 'CRESCER CEZAR DE SOUZA', 'SMDET', 1, 1),
  (gen_random_uuid(), NULL, 'CRESCER BRAZ CUBAS', 'SMDET', 2, 1),
  (gen_random_uuid(), NULL, 'CRESCER VILA BRASILEIRA', 'SMDET', 2, 1),
  (gen_random_uuid(), NULL, 'PIPA HUB', 'SMDET', 6, 3),
-- SME — efetivo 1
  (gen_random_uuid(), NULL, 'EM ILDA PEREIRA PEÑA ALVAREZ', 'SME', 1, 1),
  (gen_random_uuid(), NULL, 'EM LÁZARO GONÇALVES TEIXEIRA', 'SME', 1, 1),
  (gen_random_uuid(), NULL, 'EM LUIZ DE OLIVEIRA MACHADO', 'SME', 1, 1),
  (gen_random_uuid(), NULL, 'EM BAIRRO SÃO JOÃO KAIKAN', 'SME', 1, 1),
  (gen_random_uuid(), NULL, 'EM EUNICE DE ALMEIDA', 'SME', 1, 1),
  (gen_random_uuid(), NULL, 'EM HORÁCIO DA SILVEIRA', 'SME', 1, 1),
  (gen_random_uuid(), NULL, 'KAIKAN ASSOCIAÇÃO CULTURAL', 'SME', 1, 1),
  (gen_random_uuid(), NULL, 'EM CID TORQUATO', 'SME', 1, 1),
  (gen_random_uuid(), NULL, 'EM GERALDA FERRAZ DE CAMPOS', 'SME', 1, 1),
  (gen_random_uuid(), NULL, 'ESCOLA AMBIENTAL', 'SME', 1, 1),
  (gen_random_uuid(), NULL, 'EM KAORU HIRAMATSU', 'SME', 1, 1),
  (gen_random_uuid(), NULL, 'EM NARCISA DAS DORES PINTO', 'SME', 1, 1),
  (gen_random_uuid(), NULL, 'MUSEU DE VIVÊNCIAS EDUCACIONAIS MUVE', 'SME', 1, 1),
  (gen_random_uuid(), NULL, 'TRANSPORTE ESCOLAR', 'SME', 1, 1),
  (gen_random_uuid(), NULL, 'DEPARTAMENTO DE ALIMENTAÇÃO ESCOLAR', 'SME', 1, 1),
  (gen_random_uuid(), NULL, 'DEPARTAMENTO DE TECNOLOGIA EDUCACIONAL', 'SME', 1, 1),
  (gen_random_uuid(), NULL, 'DIVISÃO DE MANUTENÇÃO ESCOLAR', 'SME', 1, 1),
  (gen_random_uuid(), NULL, 'EM ANTONIO PEDRO RIBEIRO', 'SME', 1, 1),
  (gen_random_uuid(), NULL, 'EM BENEDITO PEREIRA DE PAULA', 'SME', 1, 1),
  (gen_random_uuid(), NULL, 'EM KAORU HIRAMATSU R', 'SME', 1, 1),
-- SME — efetivo 2
  (gen_random_uuid(), NULL, 'EM ADOLFO CARDOSO', 'SME', 2, 1),
  (gen_random_uuid(), NULL, 'EM ANA LÚCIA FERREIRA DE SOUZA', 'SME', 2, 1),
  (gen_random_uuid(), NULL, 'EM FUJITARO NAGAO', 'SME', 2, 1),
  (gen_random_uuid(), NULL, 'EM IVETE CHUERY VIEIRA TORQUATO VICCO', 'SME', 2, 1),
  (gen_random_uuid(), NULL, 'EM PRIMO VILLAR', 'SME', 2, 1),
  (gen_random_uuid(), NULL, 'EM REGINA CÉLIA NAJAR FERREIRA BORELLI', 'SME', 2, 1),
  (gen_random_uuid(), NULL, 'EM LOURENÇO DELLA NINA', 'SME', 2, 1),
  (gen_random_uuid(), NULL, 'EM ANTONIO PASCHOAL GOMES DE OLIVEIRA', 'SME', 2, 1),
  (gen_random_uuid(), NULL, 'EM MARIA APARECIDA PINHEIRO VOLPE', 'SME', 2, 1),
  (gen_random_uuid(), NULL, 'CEIM TAKAO IKEDA', 'SME', 2, 1),
  (gen_random_uuid(), NULL, 'EM JOÃO CARDOSO PEREIRA', 'SME', 2, 1),
  (gen_random_uuid(), NULL, 'EM MAURÍLIO DE SOUZA LEITE FILHO', 'SME', 2, 1),
  (gen_random_uuid(), NULL, 'EM NOSSA SENHORA DA CONCEIÇÃO', 'SME', 2, 1),
-- SME — efetivo 3
  (gen_random_uuid(), NULL, 'EM LEOPOLDINO CARDOSO DE MORAES', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'EM MARIA JOSÉ TENÓRIO DE AQUINO SILVA', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'EM MARIA COLOMBA COLELLA RODRIGUES', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'EM AFONSO CAPORALI FILHO', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'EM ISIDORO BOUCAULT', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'EM MATHILDE PIRES DE CAMPOS MASCI', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'CEIM IGNÊZ MARIA DE MORAES PETTENÁ', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'CEIM THEREZA GERALDI DE ALMEIDA TERESONA', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'EM TERESA MARTINS PINHAL', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'CEIM RICHER ROMANO NETO', 'SME', 3, 2),
  (gen_random_uuid(), NULL, 'CEMFORPE BLOCO DIDÁTICO', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'PRÉDIO SEDE DA SECRETARIA DE EDUCAÇÃO', 'SME', 3, 3),
  (gen_random_uuid(), NULL, 'EM JAIR ROCHA BATALHA', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'EM APPARECIDA FERREIRA CURSINO', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'EM WALDIR PAIVA DE OLIVEIRA FREITAS', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'CEIM ADAHYLA MARQUES CAMPOS CARNEIRO', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'CEIM DIONE ROCHA ROMANOS', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'CEIM SEBASTIÃO DA SILVA', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'EM THEREZINHA SOARES', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'CEIM HAYDÉE BRASIL DE CARVALHO', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'CEIM HORÁCIA DE LIMA BARBOSA', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'CEIM INEZELIA MOTA RONDON', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'EM ANA MARIA BARBOSA GARCIA', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'EM EMILIE NEHME AFFONSO', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'EM MILTON CRUZ', 'SME', 3, 1),
  (gen_random_uuid(), NULL, 'EM WILMA DE ALMEIDA RODRIGUES', 'SME', 3, 1),
-- SME — efetivo 4
  (gen_random_uuid(), NULL, 'EM DERMEVAL AROUCA', 'SME', 4, 1),
  (gen_random_uuid(), NULL, 'EM EULÁLIO GRUPPI', 'SME', 4, 1),
  (gen_random_uuid(), NULL, 'EM SÉRGIO HUGO PINHEIRO', 'SME', 4, 1),
  (gen_random_uuid(), NULL, 'EM JACKS GRINBERG', 'SME', 4, 1),
  (gen_random_uuid(), NULL, 'EM JOÃO ANTONIO BATALHA', 'SME', 4, 1),
  (gen_random_uuid(), NULL, 'EM JOSÉ ALVES DOS SANTOS', 'SME', 4, 1),
  (gen_random_uuid(), NULL, 'EM MARIA LUIZA MENEZES DA FONSECA', 'SME', 4, 1),
  (gen_random_uuid(), NULL, 'EM MARIA APARECIDA DE FARIA', 'SME', 4, 1),
  (gen_random_uuid(), NULL, 'CEMFORPE BLOCO AUDITÓRIO', 'SME', 4, 1),
  (gen_random_uuid(), NULL, 'EM CARLOS ALBERTO LOPES', 'SME', 4, 1),
  (gen_random_uuid(), NULL, 'EM ANTONIO NACIF SALEMI', 'SME', 4, 1),
  (gen_random_uuid(), NULL, 'EM HENRIQUE PERES', 'SME', 4, 1),
  (gen_random_uuid(), NULL, 'EMESP JOVITA FRANCO AROUCHE', 'SME', 4, 1),
  (gen_random_uuid(), NULL, 'EM LOURDES MARIA PRADO AGUIAR', 'SME', 4, 1),
  (gen_random_uuid(), NULL, 'EM JOSÉ CURY ANDERE', 'SME', 4, 1),
  (gen_random_uuid(), NULL, 'CEIC DOCE LAR III CEIM THEREZA AMORIM MARTINEZ', 'SME', 4, 4),
  (gen_random_uuid(), NULL, 'CEIM ARGÊU BATALHA', 'SME', 4, 1),
  (gen_random_uuid(), NULL, 'EM ETELVINA CÁFARO SALUSTIANO', 'SME', 4, 1),
  (gen_random_uuid(), NULL, 'EM IRACEMA BRASIL DE SIQUEIRA', 'SME', 4, 2),
  (gen_random_uuid(), NULL, 'EM MARIA COELI BEZERRA DE MELO', 'SME', 4, 1),
  (gen_random_uuid(), NULL, 'EM CYNIRA OLIVEIRA DE CASTRO', 'SME', 4, 1),
-- SME — efetivo 5
  (gen_random_uuid(), NULL, 'EM MARLENE MUNIZ SCHIMIDT', 'SME', 5, 2),
  (gen_random_uuid(), NULL, 'EM PAULO ROLIM LOUREIRO', 'SME', 5, 2),
  (gen_random_uuid(), NULL, 'EM CÉLIA PINHEIRO FRANCO', 'SME', 5, 2),
  (gen_random_uuid(), NULL, 'CEIM LOURDES GUERRA DE CAMPOS', 'SME', 5, 2),
  (gen_random_uuid(), NULL, 'EM ALMEIDA CEL', 'SME', 5, 2),
  (gen_random_uuid(), NULL, 'EM MONTEIRO LOBATO', 'SME', 5, 2),
  (gen_random_uuid(), NULL, 'EM PROF BENEDITO ESTELITA MELLO', 'SME', 5, 2),
  (gen_random_uuid(), NULL, 'EM HELIANA MAFRA MACHADO DE CASTRO', 'SME', 5, 2),
  (gen_random_uuid(), NULL, 'CEIC DOCE LAR CEIM ITAMAR ALVES DOS SANTOS', 'SME', 5, 5),
  (gen_random_uuid(), NULL, 'CEIC DOCE LAR II CEIM WILSON NOGUEIRA', 'SME', 5, 5),
  (gen_random_uuid(), NULL, 'EM DORACY BAPTISTA DE CAMPOS PEREIRA', 'SME', 5, 2),
  (gen_random_uuid(), NULL, 'PRÓ ESCOLAR RICARDO STRAZZI', 'SME', 5, 2),
  (gen_random_uuid(), NULL, 'EM WANDA DE ALMEIDA TRANDAFILOV', 'SME', 5, 2),
  (gen_random_uuid(), NULL, 'EM CENIRA ARAÚJO PEREIRA', 'SME', 5, 2),
  (gen_random_uuid(), NULL, 'EM HÉLIO DOS SANTOS NEVES', 'SME', 5, 2),
  (gen_random_uuid(), NULL, 'EM NOEMIA REAL FIDALGO', 'SME', 5, 2),
  (gen_random_uuid(), NULL, 'EM SÔNIA BRASIL DE SIQUEIRA ANDREUCCI', 'SME', 5, 2),
-- SME — efetivo 6
  (gen_random_uuid(), NULL, 'EM CECÍLIA DE SOUZA LIMA VIANNA', 'SME', 6, 2),
  (gen_random_uuid(), NULL, 'EM MARIA EUGÊNIA FOCHI DE ARAÚJO', 'SME', 6, 2),
  (gen_random_uuid(), NULL, 'EM ADOLFO MARTINI', 'SME', 6, 2),
  (gen_random_uuid(), NULL, 'EM AUTA CARDOSO DEMELLO', 'SME', 6, 2),
  (gen_random_uuid(), NULL, 'EM CLEONICE FELICIANO', 'SME', 6, 2),
-- SME — efetivo 7
  (gen_random_uuid(), NULL, 'EM RODOLPHO MEHLMANN', 'SME', 7, 2),
  (gen_random_uuid(), NULL, 'CEMPRE SÉGIO MORETTI', 'SME', 7, 2),
  (gen_random_uuid(), NULL, 'EM ASTRÉA BARRAL NÉBIAS', 'SME', 7, 2),
  (gen_random_uuid(), NULL, 'EM VANDA CONSTANTINO DA COSTA', 'SME', 7, 2),
  (gen_random_uuid(), NULL, 'EM CLÁUDIO ABRAHÃO', 'SME', 7, 2),
  (gen_random_uuid(), NULL, 'EM FLORISA FAUSTINO PINTO', 'SME', 7, 2),
  (gen_random_uuid(), NULL, 'EM LUIZ BERALDO DE MIRANDA', 'SME', 7, 2),
  (gen_random_uuid(), NULL, 'EM SÉRGIO BENEDITO FERNANDES DE ALMEIDA', 'SME', 7, 2),
  (gen_random_uuid(), NULL, 'EM ARMINDO FREIRE MÁRMORA', 'SME', 7, 2),
  (gen_random_uuid(), NULL, 'EM GUIOMAR PINHEIRO FRANCO', 'SME', 7, 2),
-- SME — efetivo 8
  (gen_random_uuid(), NULL, 'EM BENEDITO LAPORTE VIEIRA DA MOTTA', 'SME', 8, 2),
  (gen_random_uuid(), NULL, 'EM MÁRIO PORTES', 'SME', 8, 2),
  (gen_random_uuid(), NULL, 'ESCOLA VIVA JUNDIAPEBA MARLENE DA SILVA MALDONADO', 'SME', 8, 2),
-- SME — efetivos maiores
  (gen_random_uuid(), NULL, 'CEMPRE LOURDES LOPES ROMEIRO IANUZZI', 'SME', 9, 3),
  (gen_random_uuid(), NULL, 'CEMPRE OSWALDO REGINO ORNELLAS', 'SME', 10, 3),
  (gen_random_uuid(), NULL, 'EM ÁLVARO DE CAMPOS CARNEIRO', 'SME', 11, 3),
  (gen_random_uuid(), NULL, 'CEMPRE IVAN NUNES SIQUEIRA', 'SME', 12, 3),
  (gen_random_uuid(), NULL, 'CEMPRE RUTH CARDOSO', 'SME', 12, 3),
  (gen_random_uuid(), NULL, 'CEMPRE JOSÉ LIMONGI SOBRINHO', 'SME', 12, 3),
  (gen_random_uuid(), NULL, 'CEMPRE BENEDITO FERREIRA LOPES CAIC', 'SME', 17, 4),
-- SMEL
  (gen_random_uuid(), NULL, 'CER JD CAMILA', 'SMEL', 1, 1),
  (gen_random_uuid(), NULL, 'CENTRO DE ARTES MARCIAIS JUNDIAPEBA', 'SMEL', 1, 1),
  (gen_random_uuid(), NULL, 'CER JUNDIAPEBA', 'SMEL', 1, 1),
  (gen_random_uuid(), NULL, 'GIN PAULO KOBAYASHI', 'SMEL', 1, 1),
  (gen_random_uuid(), NULL, 'PRÓ HIPER', 'SMEL', 1, 1),
  (gen_random_uuid(), NULL, 'ESTÁDIO NOGUEIRÃO', 'SMEL', 1, 1),
  (gen_random_uuid(), NULL, 'PRAÇA DA JUVENTUDE', 'SMEL', 1, 1),
  (gen_random_uuid(), NULL, 'CER RODEIO', 'SMEL', 1, 1),
  (gen_random_uuid(), NULL, 'GINÁSIO PARADESPORTO', 'SMEL', 1, 1),
  (gen_random_uuid(), NULL, 'GINÁSIO HUGO RAMOS', 'SMEL', 2, 2),
  (gen_random_uuid(), NULL, 'PARQUE DA CIDADE', 'SMEL', 3, 3),
  (gen_random_uuid(), NULL, 'GINÁSIO TUTA', 'SMEL', 3, 3),
  (gen_random_uuid(), NULL, 'PARQUE AIRTON NOGUEIRA', 'SMEL', 3, 3),
-- SMGCP
  (gen_random_uuid(), NULL, 'PAC BIRITIBA', 'SMGCP', 1, 1),
  (gen_random_uuid(), NULL, 'PAC BRAZ CUBAS', 'SMGCP', 1, 0),
  (gen_random_uuid(), NULL, 'POLO DA BELEZA', 'SMGCP', 1, 1),
  (gen_random_uuid(), NULL, 'ALMOXARIFADO CASEM', 'SMGCP', 3, 0),
  (gen_random_uuid(), NULL, 'ESCOLA DE GOVERNO', 'SMGCP', 4, 1),
  (gen_random_uuid(), NULL, 'PAÇO MUNICIPAL', 'SMGCP', 19, 5),
-- SMGOV
  (gen_random_uuid(), NULL, 'ÁREA EXTERNA AO ARQUIVO GERAL', 'SMGOV', 1, 1),
  (gen_random_uuid(), NULL, 'ARQUIVO CASEM', 'SMGOV', 1, 1),
-- SMMT
  (gen_random_uuid(), NULL, 'SED DEPTO EDUCAÇÃO TRÂNSITO E SEGURANÇA VIÁRIA', 'SMMT', 1, 1),
  (gen_random_uuid(), NULL, 'PRÉDIO OPERACIONAL DA SMMU', 'SMMT', 4, 2),
  (gen_random_uuid(), NULL, 'TERMINAL ESTUDANTES', 'SMMT', 10, 6),
  (gen_random_uuid(), NULL, 'TERMINAL CENTRAL', 'SMMT', 12, 6),
-- SMS — efetivo 1
  (gen_random_uuid(), NULL, 'CEADIM', 'SMS', 1, 1),
  (gen_random_uuid(), NULL, 'CECCO', 'SMS', 1, 1),
  (gen_random_uuid(), NULL, 'EMESP SAÚDE', 'SMS', 1, 1),
-- SMS — efetivo 2
  (gen_random_uuid(), NULL, 'UBS JARDIM IVETE', 'SMS', 2, 2),
  (gen_random_uuid(), NULL, 'UBS VILA DA PRATA', 'SMS', 2, 2),
  (gen_random_uuid(), NULL, 'UBS VILA MORAES', 'SMS', 2, 1),
  (gen_random_uuid(), NULL, 'UBS VILA JUNDIAI', 'SMS', 2, 2),
  (gen_random_uuid(), NULL, 'ALMOXARIFADO SAÚDE', 'SMS', 2, 1),
  (gen_random_uuid(), NULL, 'PROMEG HIPERDIA', 'SMS', 2, 3),
  (gen_random_uuid(), NULL, 'UBS PONTE GRANDE', 'SMS', 2, 4),
  (gen_random_uuid(), NULL, 'CAPS I', 'SMS', 2, 2),
  (gen_random_uuid(), NULL, 'CAPS II', 'SMS', 2, 2),
  (gen_random_uuid(), NULL, 'CCZ CENTRO DE CONTROLE DE ZOONOSES', 'SMS', 2, 2),
  (gen_random_uuid(), NULL, 'CURE SETOR AMBULÂNCIA', 'SMS', 2, 2),
  (gen_random_uuid(), NULL, 'UAPS I', 'SMS', 2, 1),
  (gen_random_uuid(), NULL, 'UAPS II', 'SMS', 2, 1),
  (gen_random_uuid(), NULL, 'UBS BRAZ CUBAS', 'SMS', 2, 3),
  (gen_random_uuid(), NULL, 'UBS MINERAÇÃO', 'SMS', 2, 1),
  (gen_random_uuid(), NULL, 'UBS SANTO ÂNGELO', 'SMS', 2, 2),
  (gen_random_uuid(), NULL, 'UBS VILA NOVA APARECIDA', 'SMS', 2, 2),
  (gen_random_uuid(), NULL, 'CENTRO MUNICIPAL DE SAÚDE MENTAL', 'SMS', 2, 2),
  (gen_random_uuid(), NULL, 'UBS BOTUJURU', 'SMS', 2, 3),
  (gen_random_uuid(), NULL, 'UBS JARDIM MARICÁ', 'SMS', 2, 1),
  (gen_random_uuid(), NULL, 'UBS SABAÚNA', 'SMS', 2, 1),
-- SMS — efetivo 3
  (gen_random_uuid(), NULL, 'UBS JARDIM CAMILA', 'SMS', 3, 4),
  (gen_random_uuid(), NULL, 'UBS VILA NATAL', 'SMS', 3, 3),
  (gen_random_uuid(), NULL, 'UBS JUNDIAPEBA', 'SMS', 3, 4),
  (gen_random_uuid(), NULL, 'UBS VILA SUISSA', 'SMS', 3, 4),
-- SMS — efetivo 4
  (gen_random_uuid(), NULL, 'SECRETARIA DA SAÚDE', 'SMS', 4, 4),
  (gen_random_uuid(), NULL, 'UBS SANTA TEREZA', 'SMS', 4, 5),
-- SMSEG
  (gen_random_uuid(), NULL, 'CORPO DE BOMBEIROS BRÁS CUBAS', 'SMSEG', 1, 1),
  (gen_random_uuid(), NULL, 'CANIL DA GUARDA CIVIL MUNICIPAL', 'SMSEG', 1, 1),
  (gen_random_uuid(), NULL, 'CORPO DE BOMBEIROS SHANGUAI', 'SMSEG', 2, 1),
  (gen_random_uuid(), NULL, 'POLO DE SEGURANÇA BASE GM JUNDIAPEBA', 'SMSEG', 3, 2),
  (gen_random_uuid(), NULL, 'COI CENTRO DE OPERAÇÕES INTEGRADAS', 'SMSEG', 3, 1),
-- SMSUZ
  (gen_random_uuid(), NULL, 'CEMITÉRIO DA SAUDADE', 'SMSUZ', 1, 1),
  (gen_random_uuid(), NULL, 'CEMITÉRIO SÃO SALVADOR', 'SMSUZ', 1, 1),
  (gen_random_uuid(), NULL, 'PRÉDIO SEDE DA SECRETARIA DE INFRAESTRUTURA URBANA', 'SMSUZ', 3, 1);

-- ============================================================
-- COMPOSICAO_POSTOS (330 registros: 209 Agente + 121 Ajudante)
-- SMS  → AGENTE DE HIGIENIZAÇÃO A para as vagas insalubres
-- SMMT → AGENTE DE HIGIENIZAÇÃO C para as vagas insalubres
-- demais → AGENTE DE HIGIENIZAÇÃO B para as vagas insalubres
-- Ajudante de Limpeza preenche (efetivo_previsto - cota_insalubridade)
-- Atenção: 8 postos da SMS têm cota > efetivo_previsto (dado informado);
-- esses postos geram 0 vagas de Ajudante e quantidade > efetivo no Agente.
-- ============================================================

-- vagas insalubres (cota_insalubridade > 0) — 209 linhas
INSERT INTO composicao_postos (posto_id, funcao_id, quantidade)
SELECT
  p.id,
  f.id,
  p.cota_insalubridade
FROM postos p
JOIN funcoes f ON f.nome = CASE
  WHEN p.secretaria = 'SMS'  THEN 'AGENTE DE HIGIENIZAÇÃO A'
  WHEN p.secretaria = 'SMMT' THEN 'AGENTE DE HIGIENIZAÇÃO C'
  ELSE                            'AGENTE DE HIGIENIZAÇÃO B'
END
WHERE p.efetivo_previsto > 0
  AND p.cota_insalubridade > 0;

-- vagas restantes → Ajudante de Limpeza — 121 linhas
INSERT INTO composicao_postos (posto_id, funcao_id, quantidade)
SELECT
  p.id,
  f.id,
  p.efetivo_previsto - p.cota_insalubridade
FROM postos p
JOIN funcoes f ON f.nome = 'AJUDANTE DE LIMPEZA'
WHERE p.efetivo_previsto > 0
  AND p.efetivo_previsto > p.cota_insalubridade;

-- ============================================================
-- TODO: após criar o usuário no Supabase Auth, execute:
-- INSERT INTO perfis (id, nome, email, role) VALUES ('<UUID-DO-AUTH>', 'Rodolfo', 'rfpaulussi@hotmail.com', 'admin');
-- ============================================================
