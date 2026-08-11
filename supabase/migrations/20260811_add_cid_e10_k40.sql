-- CID E10: Diabetes mellitus insulino-dependente
INSERT INTO cid_referencia (codigo, descricao) VALUES
('E10',   'Diabetes mellitus insulino-dependente'),
('E10.0', 'Diabetes mellitus insulino-dependente - com coma'),
('E10.1', 'Diabetes mellitus insulino-dependente - com cetoacidose'),
('E10.2', 'Diabetes mellitus insulino-dependente - com complicações renais'),
('E10.3', 'Diabetes mellitus insulino-dependente - com complicações oftálmicas'),
('E10.4', 'Diabetes mellitus insulino-dependente - com complicações neurológicas'),
('E10.5', 'Diabetes mellitus insulino-dependente - com complicações circulatórias periféricas'),
('E10.6', 'Diabetes mellitus insulino-dependente - com outras complicações especificadas'),
('E10.7', 'Diabetes mellitus insulino-dependente - com complicações múltiplas'),
('E10.8', 'Diabetes mellitus insulino-dependente - com complicações não especificadas'),
('E10.9', 'Diabetes mellitus insulino-dependente - sem complicações')
ON CONFLICT (codigo) DO NOTHING;

-- CID K40: Hérnia inguinal
INSERT INTO cid_referencia (codigo, descricao) VALUES
('K40',   'Hérnia inguinal'),
('K40.0', 'Hérnia inguinal bilateral, com obstrução, sem gangrena'),
('K40.1', 'Hérnia inguinal bilateral, com gangrena'),
('K40.2', 'Hérnia inguinal bilateral, sem obstrução ou gangrena'),
('K40.3', 'Hérnia inguinal unilateral ou não especificada, com obstrução, sem gangrena'),
('K40.4', 'Hérnia inguinal unilateral ou não especificada, com gangrena'),
('K40.9', 'Hérnia inguinal unilateral ou não especificada, sem obstrução ou gangrena')
ON CONFLICT (codigo) DO NOTHING;
