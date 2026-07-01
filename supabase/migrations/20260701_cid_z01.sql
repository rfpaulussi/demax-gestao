INSERT INTO cid_referencia (codigo, descricao) VALUES
('Z01',   'Exame especial de investigação e de rastreamento'),
('Z01.0', 'Exame dos olhos e da visão'),
('Z01.1', 'Exame dos ouvidos e da audição'),
('Z01.2', 'Exame dentário'),
('Z01.3', 'Exame da pressão arterial'),
('Z01.4', 'Exame ginecológico geral (rotina)'),
('Z01.5', 'Diagnóstico e teste de sensibilidade alérgica'),
('Z01.6', 'Exame radiológico não classificado em outra parte'),
('Z01.7', 'Exame de sangue em laboratório'),
('Z01.8', 'Outros exames especiais especificados'),
('Z01.9', 'Exame especial não especificado')
ON CONFLICT (codigo) DO NOTHING;
