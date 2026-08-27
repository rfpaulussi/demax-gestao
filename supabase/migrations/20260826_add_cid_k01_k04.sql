-- CID K01: Dentes inclusos e impactados (falta K01.0; K01.1 já cadastrado)
INSERT INTO cid_referencia (codigo, descricao) VALUES
('K01.0', 'Dentes inclusos')
ON CONFLICT (codigo) DO NOTHING;

-- CID K04: Doenças da polpa e dos tecidos periapicais
INSERT INTO cid_referencia (codigo, descricao) VALUES
('K04',   'Doenças da polpa e dos tecidos periapicais'),
('K04.0', 'Pulpite'),
('K04.1', 'Necrose da polpa'),
('K04.2', 'Degeneração da polpa'),
('K04.3', 'Formação anormal de tecido duro na polpa'),
('K04.4', 'Periodontite apical originada na polpa'),
('K04.5', 'Periodontite apical crônica'),
('K04.6', 'Abscesso periapical com fístula'),
('K04.7', 'Abscesso periapical sem fístula'),
('K04.8', 'Cisto radicular'),
('K04.9', 'Outras doenças e as não especificadas da polpa e dos tecidos periapicais')
ON CONFLICT (codigo) DO NOTHING;
