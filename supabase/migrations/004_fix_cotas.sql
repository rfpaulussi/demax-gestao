-- ============================================================
-- 004_fix_cotas.sql — Demax Gestão — Correção de cota_insalubridade
-- Execute este script UMA ÚNICA VEZ em ambientes onde o seed
-- 003_seed.sql foi aplicado antes de incluir cota_insalubridade
-- no INSERT de postos (i.e., antes do Ajuste 1).
-- ============================================================

UPDATE postos
SET cota_insalubridade = CASE nome
  WHEN 'SEDE'                                                      THEN 0
  WHEN 'CRAS JARDIM LAYR'                                          THEN 1
  WHEN 'CRAS JUNDIAPEBA II'                                        THEN 1
  WHEN 'CRAS VILA BRASILEIRA'                                      THEN 1
  WHEN 'CRAS VILA NOVA UNIÃO'                                      THEN 1
  WHEN 'CREAS BRAZ CUBAS'                                          THEN 1
  WHEN 'SECRETARIA DE ASSISTÊNCIA SOCIAL - PRÉDIO II PMMC'         THEN 1
  WHEN 'VILA DIGNIDADE'                                            THEN 1
  WHEN 'CENTRO POP'                                                THEN 2
  WHEN 'CIC JUNDIAPEBA'                                            THEN 2
  WHEN 'CONSELHO TUTELAR DE JUNDIAPEBA / BRÁS CUBAS / CENTRO'      THEN 2
  WHEN 'ILHA MARABÁ'                                               THEN 0
  WHEN 'NUBEA'                                                     THEN 2
  WHEN 'PARQUE LEON FEFFER'                                        THEN 2
  WHEN 'PARQUE CENTENÁRIO'                                         THEN 4
  WHEN 'MERCADO DO PRODUTOR MINOR HARADA'                          THEN 5
  WHEN 'ARQUIVO HISTÓRICO / PINACOTECA'                            THEN 1
  WHEN 'CASARÃO'                                                   THEN 1
  WHEN 'CENTRO DE ARTE, ESPORTE E DESENVOLVIMENTO - CAED'          THEN 1
  WHEN 'CENTRO DE CULTURA E MEMÓRIA EXPEDICIONÁRIOS MOGIANOS / EMAM' THEN 1
  WHEN 'CIARTE'                                                    THEN 1
  WHEN 'MUSEU TARO KONNO'                                          THEN 1
  WHEN 'TEATRO VASQUES'                                            THEN 1
  WHEN 'CENTRO CULTURAL / CASA DO HIP HOP'                         THEN 2
  WHEN 'CRESCER BRAZ CUBAS'                                        THEN 1
  WHEN 'CRESCER CEZAR DE SOUZA'                                    THEN 1
  WHEN 'CRESCER VILA BRASILEIRA'                                   THEN 1
  WHEN 'PIPA HUB'                                                  THEN 3
  WHEN 'CEIM ADAHYLA MARQUES CAMPOS CARNEIRO'                      THEN 1
  WHEN 'CEIM ARGÊU BATALHA'                                        THEN 1
  WHEN 'CEIM DIONE ROCHA ROMANOS'                                  THEN 1
  WHEN 'CEIM HAYDÉE BRASIL DE CARVALHO'                            THEN 1
  WHEN 'CEIM HORÁCIA DE LIMA BARBOSA'                              THEN 1
  WHEN 'CEIM IGNÊZ MARIA DE MORAES PETTENÁ'                        THEN 1
  WHEN 'CEIM INEZELIA MOTA RONDON'                                 THEN 1
  WHEN 'CEIM SEBASTIÃO DA SILVA'                                   THEN 1
  WHEN 'CEIM TAKAO IKEDA'                                          THEN 1
  WHEN 'CEIM THEREZA GERALDI DE ALMEIDA TERESONA'                  THEN 1
  WHEN 'CEMFORPE BLOCO AUDITÓRIO'                                  THEN 1
  WHEN 'CEMFORPE BLOCO DIDÁTICO'                                   THEN 1
  WHEN 'DEPARTAMENTO DE ALIMENTAÇÃO ESCOLAR'                       THEN 1
  WHEN 'DEPARTAMENTO DE TECNOLOGIA EDUCACIONAL'                    THEN 1
  WHEN 'DIVISÃO DE MANUTENÇÃO ESCOLAR'                             THEN 1
  WHEN 'EM ADOLFO CARDOSO'                                         THEN 1
  WHEN 'EM ANA LÚCIA FERREIRA DE SOUZA'                            THEN 1
  WHEN 'EM ANA MARIA BARBOSA GARCIA'                               THEN 1
  WHEN 'EM ANTONIO NACIF SALEMI'                                   THEN 1
  WHEN 'EM ANTONIO PASCHOAL GOMES DE OLIVEIRA'                     THEN 1
  WHEN 'EM ANTONIO PEDRO RIBEIRO'                                  THEN 1
  WHEN 'EM CARLOS ALBERTO LOPES'                                   THEN 1
  WHEN 'EM DERMEVAL AROUCA'                                        THEN 1
  WHEN 'EM EMILIE NEHME AFFONSO'                                   THEN 1
  WHEN 'EM ETELVINA CÁFARO SALUSTIANO'                             THEN 1
  WHEN 'EM EULÁLIO GRUPPI'                                         THEN 1
  WHEN 'EM FUJITARO NAGAO'                                         THEN 1
  WHEN 'EM HENRIQUE PERES'                                         THEN 1
  WHEN 'EM ILDA PEREIRA PEÑA ALVAREZ'                              THEN 1
  WHEN 'EM IVETE CHUERY VIEIRA TORQUATO VICCO'                     THEN 1
  WHEN 'EM JACKS GRINBERG'                                         THEN 1
  WHEN 'EM JAIR ROCHA BATALHA'                                     THEN 1
  WHEN 'EM JOÃO ANTONIO BATALHA'                                   THEN 1
  WHEN 'EM JOÃO CARDOSO PEREIRA'                                   THEN 1
  WHEN 'EM JOSÉ ALVES DOS SANTOS'                                  THEN 1
  WHEN 'EM KAORU HIRAMATSU'                                        THEN 1
  WHEN 'EM LÁZARO GONÇALVES TEIXEIRA'                              THEN 1
  WHEN 'EM LEOPOLDINO CARDOSO DE MORAES'                           THEN 1
  WHEN 'EM LOURDES MARIA PRADO AGUIAR'                             THEN 1
  WHEN 'EM LOURENÇO DELLA NINA'                                    THEN 1
  WHEN 'EM LUIZ DE OLIVEIRA MACHADO'                               THEN 1
  WHEN 'EM MARIA APARECIDA PINHEIRO VOLPE'                         THEN 1
  WHEN 'EM MARIA COELI BEZERRA DE MELO'                            THEN 1
  WHEN 'EM MARIA JOSÉ TENÓRIO DE AQUINO SILVA'                     THEN 1
  WHEN 'EM MARIA LUIZA MENEZES DA FONSECA'                         THEN 1
  WHEN 'EM MAURÍLIO DE SOUZA LEITE FILHO'                          THEN 1
  WHEN 'EM MILTON CRUZ'                                            THEN 1
  WHEN 'EM PRIMO VILLAR'                                           THEN 1
  WHEN 'EM MARIA COLOMBA COLELLA RODRIGUES'                        THEN 1
  WHEN 'EM REGINA CÉLIA NAJAR FERREIRA BORELLI'                    THEN 1
  WHEN 'EM SÉRGIO HUGO PINHEIRO'                                   THEN 1
  WHEN 'EM TERESA MARTINS PINHAL'                                  THEN 1
  WHEN 'EM THEREZINHA SOARES'                                      THEN 1
  WHEN 'EM BAIRRO SÃO JOÃO KAIKAN'                                 THEN 1
  WHEN 'EM BENEDITO PEREIRA DE PAULA'                              THEN 1
  WHEN 'EM CID TORQUATO'                                           THEN 1
  WHEN 'EM EUNICE DE ALMEIDA'                                      THEN 1
  WHEN 'EM GERALDA FERRAZ DE CAMPOS'                               THEN 1
  WHEN 'EM KAORU HIRAMATSU R'                                      THEN 1
  WHEN 'EM NOSSA SENHORA DA CONCEIÇÃO'                             THEN 1
  WHEN 'EM HORÁCIO DA SILVEIRA'                                    THEN 1
  WHEN 'EM AFONSO CAPORALI FILHO'                                  THEN 1
  WHEN 'EM APPARECIDA FERREIRA CURSINO'                            THEN 1
  WHEN 'EM CYNIRA OLIVEIRA DE CASTRO'                              THEN 1
  WHEN 'EM ISIDORO BOUCAULT'                                       THEN 1
  WHEN 'EM JOSÉ CURY ANDERE'                                       THEN 1
  WHEN 'EM MARIA APARECIDA DE FARIA'                               THEN 1
  WHEN 'EM MATHILDE PIRES DE CAMPOS MASCI'                         THEN 1
  WHEN 'EM NARCISA DAS DORES PINTO'                                THEN 1
  WHEN 'EM WALDIR PAIVA DE OLIVEIRA FREITAS'                       THEN 1
  WHEN 'EM WILMA DE ALMEIDA RODRIGUES'                             THEN 1
  WHEN 'EMESP JOVITA FRANCO AROUCHE'                               THEN 1
  WHEN 'ESCOLA AMBIENTAL'                                          THEN 1
  WHEN 'MUSEU DE VIVÊNCIAS EDUCACIONAIS MUVE'                      THEN 1
  WHEN 'TRANSPORTE ESCOLAR'                                        THEN 1
  WHEN 'CEIM LOURDES GUERRA DE CAMPOS'                             THEN 2
  WHEN 'CEIM RICHER ROMANO NETO'                                   THEN 2
  WHEN 'CEMPRE SÉGIO MORETTI'                                      THEN 2
  WHEN 'EM ADOLFO MARTINI'                                         THEN 2
  WHEN 'EM ALMEIDA CEL'                                            THEN 2
  WHEN 'EM ARMINDO FREIRE MÁRMORA'                                 THEN 2
  WHEN 'EM ASTRÉA BARRAL NÉBIAS'                                   THEN 2
  WHEN 'EM AUTA CARDOSO DEMELLO'                                   THEN 2
  WHEN 'EM BENEDITO LAPORTE VIEIRA DA MOTTA'                       THEN 2
  WHEN 'EM CECÍLIA DE SOUZA LIMA VIANNA'                           THEN 2
  WHEN 'EM CENIRA ARAÚJO PEREIRA'                                  THEN 2
  WHEN 'EM CLÁUDIO ABRAHÃO'                                        THEN 2
  WHEN 'EM CLEONICE FELICIANO'                                     THEN 2
  WHEN 'EM DORACY BAPTISTA DE CAMPOS PEREIRA'                      THEN 2
  WHEN 'EM FLORISA FAUSTINO PINTO'                                 THEN 2
  WHEN 'EM GUIOMAR PINHEIRO FRANCO'                                THEN 2
  WHEN 'EM HELIANA MAFRA MACHADO DE CASTRO'                        THEN 2
  WHEN 'EM HÉLIO DOS SANTOS NEVES'                                 THEN 2
  WHEN 'EM IRACEMA BRASIL DE SIQUEIRA'                             THEN 2
  WHEN 'EM LUIZ BERALDO DE MIRANDA'                                THEN 2
  WHEN 'EM MARIA EUGÊNIA FOCHI DE ARAÚJO'                          THEN 2
  WHEN 'EM MÁRIO PORTES'                                           THEN 2
  WHEN 'EM MARLENE MUNIZ SCHIMIDT'                                 THEN 2
  WHEN 'EM MONTEIRO LOBATO'                                        THEN 2
  WHEN 'EM NOEMIA REAL FIDALGO'                                    THEN 2
  WHEN 'EM PAULO ROLIM LOUREIRO'                                   THEN 2
  WHEN 'EM PROF BENEDITO ESTELITA MELLO'                           THEN 2
  WHEN 'EM RODOLPHO MEHLMANN'                                      THEN 2
  WHEN 'EM SÉRGIO BENEDITO FERNANDES DE ALMEIDA'                   THEN 2
  WHEN 'EM SÔNIA BRASIL DE SIQUEIRA ANDREUCCI'                     THEN 2
  WHEN 'EM VANDA CONSTANTINO DA COSTA'                             THEN 2
  WHEN 'EM CÉLIA PINHEIRO FRANCO'                                  THEN 2
  WHEN 'ESCOLA VIVA JUNDIAPEBA MARLENE DA SILVA MALDONADO'         THEN 2
  WHEN 'PRÓ ESCOLAR RICARDO STRAZZI'                               THEN 2
  WHEN 'EM WANDA DE ALMEIDA TRANDAFILOV'                           THEN 2
  WHEN 'CEMPRE IVAN NUNES SIQUEIRA'                                THEN 3
  WHEN 'CEMPRE LOURDES LOPES ROMEIRO IANUZZI'                      THEN 3
  WHEN 'CEMPRE OSWALDO REGINO ORNELLAS'                            THEN 3
  WHEN 'CEMPRE RUTH CARDOSO'                                       THEN 3
  WHEN 'CEMPRE JOSÉ LIMONGI SOBRINHO'                              THEN 3
  WHEN 'EM ÁLVARO DE CAMPOS CARNEIRO'                              THEN 3
  WHEN 'PRÉDIO SEDE DA SECRETARIA DE EDUCAÇÃO'                     THEN 3
  WHEN 'CEIC DOCE LAR III CEIM THEREZA AMORIM MARTINEZ'            THEN 4
  WHEN 'CEMPRE BENEDITO FERREIRA LOPES CAIC'                       THEN 4
  WHEN 'CEIC DOCE LAR CEIM ITAMAR ALVES DOS SANTOS'                THEN 5
  WHEN 'CEIC DOCE LAR II CEIM WILSON NOGUEIRA'                     THEN 5
  WHEN 'KAIKAN ASSOCIAÇÃO CULTURAL'                                THEN 1
  WHEN 'CENTRO DE ARTES MARCIAIS JUNDIAPEBA'                       THEN 1
  WHEN 'CER JD CAMILA'                                             THEN 1
  WHEN 'CER JUNDIAPEBA'                                            THEN 1
  WHEN 'CER RODEIO'                                                THEN 1
  WHEN 'ESTÁDIO NOGUEIRÃO'                                         THEN 1
  WHEN 'GIN PAULO KOBAYASHI'                                       THEN 1
  WHEN 'GINÁSIO PARADESPORTO'                                      THEN 1
  WHEN 'PRAÇA DA JUVENTUDE'                                        THEN 1
  WHEN 'PRÓ HIPER'                                                 THEN 1
  WHEN 'GINÁSIO HUGO RAMOS'                                        THEN 2
  WHEN 'GINÁSIO TUTA'                                              THEN 3
  WHEN 'PARQUE AIRTON NOGUEIRA'                                    THEN 3
  WHEN 'PARQUE DA CIDADE'                                          THEN 3
  WHEN 'ESCOLA DE GOVERNO'                                         THEN 1
  WHEN 'PAC BIRITIBA'                                              THEN 1
  WHEN 'POLO DA BELEZA'                                            THEN 1
  WHEN 'ALMOXARIFADO CASEM'                                        THEN 0
  WHEN 'PAC BRAZ CUBAS'                                            THEN 0
  WHEN 'PAÇO MUNICIPAL'                                            THEN 5
  WHEN 'ÁREA EXTERNA AO ARQUIVO GERAL'                             THEN 1
  WHEN 'ARQUIVO CASEM'                                             THEN 1
  WHEN 'SED DEPTO EDUCAÇÃO TRÂNSITO E SEGURANÇA VIÁRIA'            THEN 1
  WHEN 'PRÉDIO OPERACIONAL DA SMMU'                                THEN 2
  WHEN 'TERMINAL CENTRAL'                                          THEN 6
  WHEN 'TERMINAL ESTUDANTES'                                       THEN 6
  WHEN 'CEADIM'                                                    THEN 1
  WHEN 'CECCO'                                                     THEN 1
  WHEN 'EMESP SAÚDE'                                               THEN 1
  WHEN 'ALMOXARIFADO SAÚDE'                                        THEN 1
  WHEN 'UAPS I'                                                    THEN 1
  WHEN 'UAPS II'                                                   THEN 1
  WHEN 'UBS JARDIM MARICÁ'                                         THEN 1
  WHEN 'UBS MINERAÇÃO'                                             THEN 1
  WHEN 'UBS SABAÚNA'                                               THEN 1
  WHEN 'UBS SANTO ÂNGELO'                                          THEN 2
  WHEN 'UBS VILA MORAES'                                           THEN 1
  WHEN 'CAPS I'                                                    THEN 2
  WHEN 'CAPS II'                                                   THEN 2
  WHEN 'CCZ CENTRO DE CONTROLE DE ZOONOSES'                        THEN 2
  WHEN 'CENTRO MUNICIPAL DE SAÚDE MENTAL'                          THEN 2
  WHEN 'CURE SETOR AMBULÂNCIA'                                     THEN 2
  WHEN 'UBS BRAZ CUBAS'                                            THEN 3
  WHEN 'UBS JARDIM IVETE'                                          THEN 2
  WHEN 'UBS VILA DA PRATA'                                         THEN 2
  WHEN 'UBS VILA JUNDIAI'                                          THEN 2
  WHEN 'UBS VILA NOVA APARECIDA'                                   THEN 2
  WHEN 'PROMEG HIPERDIA'                                           THEN 3
  WHEN 'UBS BOTUJURU'                                              THEN 3
  WHEN 'UBS JARDIM CAMILA'                                         THEN 4
  WHEN 'UBS JUNDIAPEBA'                                            THEN 4
  WHEN 'UBS VILA NATAL'                                            THEN 3
  WHEN 'SECRETARIA DA SAÚDE'                                       THEN 4
  WHEN 'UBS PONTE GRANDE'                                          THEN 4
  WHEN 'UBS SANTA TEREZA'                                          THEN 5
  WHEN 'UBS VILA SUISSA'                                           THEN 4
  WHEN 'CANIL DA GUARDA CIVIL MUNICIPAL'                           THEN 1
  WHEN 'COI CENTRO DE OPERAÇÕES INTEGRADAS'                        THEN 1
  WHEN 'CORPO DE BOMBEIROS BRÁS CUBAS'                             THEN 1
  WHEN 'CORPO DE BOMBEIROS SHANGUAI'                               THEN 1
  WHEN 'POLO DE SEGURANÇA BASE GM JUNDIAPEBA'                      THEN 2
  WHEN 'CEMITÉRIO DA SAUDADE'                                      THEN 1
  WHEN 'CEMITÉRIO SÃO SALVADOR'                                    THEN 1
  WHEN 'PRÉDIO SEDE DA SECRETARIA DE INFRAESTRUTURA URBANA'        THEN 1
  ELSE 0
END;

-- ============================================================
-- Correção: 8 postos da SMS com cota_insalubridade > efetivo_previsto
-- (PROMEG HIPERDIA, UBS PONTE GRANDE, UBS BRAZ CUBAS, UBS BOTUJURU,
--  UBS JARDIM CAMILA, UBS JUNDIAPEBA, UBS VILA SUISSA, UBS SANTA TEREZA)
-- Limita cota ao máximo possível = efetivo_previsto.
-- ============================================================
UPDATE postos SET cota_insalubridade = efetivo_previsto
WHERE secretaria = 'SMS'
  AND cota_insalubridade > efetivo_previsto;
