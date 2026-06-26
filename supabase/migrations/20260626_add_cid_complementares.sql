-- Dermatológicos: contato com produtos químicos de limpeza
INSERT INTO cid_referencia (codigo, descricao) VALUES
('L23',   'Dermatite alérgica de contato'),
('L23.0', 'Dermatite alérgica de contato por metais'),
('L23.5', 'Dermatite alérgica de contato por outros produtos químicos'),
('L23.9', 'Dermatite alérgica de contato, causa não especificada'),
('L24',   'Dermatite de contato por irritante'),
('L24.2', 'Dermatite de contato por irritante por solventes'),
('L24.5', 'Dermatite de contato por irritante por outros produtos químicos'),
('L24.9', 'Dermatite de contato por irritante, causa não especificada'),
('L30',   'Outras dermatites')
ON CONFLICT (codigo) DO NOTHING;

-- Calor/exposição solar: trabalhadores externos
INSERT INTO cid_referencia (codigo, descricao) VALUES
('T67',   'Efeitos do calor e da luz'),
('T67.0', 'Insolação e golpe de calor'),
('T67.3', 'Exaustão pelo calor por depleção hídrica'),
('T67.4', 'Exaustão pelo calor por depleção de sal'),
('T67.5', 'Exaustão pelo calor, não especificada'),
('T67.6', 'Fadiga pelo calor, transitória')
ON CONFLICT (codigo) DO NOTHING;

-- Respiratórios: poeira e produtos químicos
INSERT INTO cid_referencia (codigo, descricao) VALUES
('J06',   'Infecção aguda das vias aéreas superiores'),
('J20',   'Bronquite aguda'),
('J20.9', 'Bronquite aguda não especificada'),
('J30',   'Rinite alérgica e vasomotora'),
('J30.1', 'Rinite alérgica devida a pólen'),
('J30.3', 'Outras rinites alérgicas'),
('J40',   'Bronquite não especificada')
ON CONFLICT (codigo) DO NOTHING;

-- Mental: estresse, adaptação, burnout
INSERT INTO cid_referencia (codigo, descricao) VALUES
('F33',   'Transtorno depressivo recorrente'),
('F33.0', 'Transtorno depressivo recorrente, episódio atual leve'),
('F33.1', 'Transtorno depressivo recorrente, episódio atual moderado'),
('F41.0', 'Transtorno de pânico'),
('F43',   'Reações ao estresse grave e transtornos de adaptação'),
('F43.0', 'Reação aguda ao estresse'),
('F43.1', 'Transtorno de estresse pós-traumático'),
('F43.2', 'Transtorno de adaptação'),
('F43.8', 'Outras reações ao estresse grave'),
('Z73',   'Problemas relacionados à dificuldade de gerenciamento da vida (burnout)')
ON CONFLICT (codigo) DO NOTHING;

-- Metabólico: alta prevalência no perfil da equipe
INSERT INTO cid_referencia (codigo, descricao) VALUES
('E11',   'Diabetes mellitus tipo 2'),
('E11.9', 'Diabetes mellitus tipo 2 sem complicações'),
('E14',   'Diabetes mellitus não especificado')
ON CONFLICT (codigo) DO NOTHING;

-- Digestivo
INSERT INTO cid_referencia (codigo, descricao) VALUES
('K21',   'Doença do refluxo gastroesofágico'),
('K21.0', 'Doença do refluxo gastroesofágico com esofagite')
ON CONFLICT (codigo) DO NOTHING;

-- Musculoesquelético adicional
INSERT INTO cid_referencia (codigo, descricao) VALUES
('M47',   'Espondilose'),
('M47.8', 'Outras espondiloses'),
('M47.9', 'Espondilose não especificada'),
('M70',   'Transtornos dos tecidos moles relacionados ao uso excessivo'),
('M70.0', 'Sinovite e tenossinovite crônicas da mão e punho'),
('M70.2', 'Bursite do olécrano'),
('M70.3', 'Outras bursites do cotovelo'),
('M70.6', 'Bursite trocantérica'),
('M70.9', 'Transtorno não especificado dos tecidos moles por uso excessivo')
ON CONFLICT (codigo) DO NOTHING;

-- Traumatismos específicos de membros (complemento ao S00-T98 genérico)
INSERT INTO cid_referencia (codigo, descricao) VALUES
('S40',   'Traumatismo superficial do ombro e do braço'),
('S42',   'Fratura do ombro e do braço'),
('S46',   'Traumatismo de músculo e tendão do ombro e braço'),
('S80',   'Traumatismo superficial da perna'),
('S82',   'Fratura da perna'),
('S90',   'Traumatismo superficial do tornozelo e do pé'),
('S92',   'Fratura do pé'),
('S93',   'Luxação e entorse do tornozelo e articulações do pé')
ON CONFLICT (codigo) DO NOTHING;

-- Nexo ocupacional para dermatológicos e calor (limpeza/externo)
UPDATE cid_referencia SET nexo_ocupacional_limpeza = true
WHERE codigo IN (
  'L23','L23.0','L23.5','L23.9',
  'L24','L24.2','L24.5','L24.9',
  'T67','T67.0','T67.3','T67.4','T67.5','T67.6',
  'M70','M70.0','M70.2','M70.3','M70.6','M70.9'
);
