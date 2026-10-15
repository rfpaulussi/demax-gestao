-- CID N20: Calculose do rim e do ureter
INSERT INTO cid_referencia (codigo, descricao) VALUES
('N20',   'Calculose do rim e do ureter'),
('N20.0', 'Calculose do rim'),
('N20.1', 'Calculose do ureter'),
('N20.2', 'Calculose do rim com calculose do ureter'),
('N20.9', 'Calculose urinária, não especificada')
ON CONFLICT (codigo) DO NOTHING;

-- CID S63: Luxação, entorse e distensão das articulações e dos ligamentos ao nível do punho e da mão
-- (S63.6 já cadastrado em 20260625_add_cid_s60.sql)
INSERT INTO cid_referencia (codigo, descricao) VALUES
('S63',   'Luxação, entorse e distensão das articulações e dos ligamentos ao nível do punho e da mão'),
('S63.0', 'Luxação do punho'),
('S63.1', 'Luxação do dedo'),
('S63.2', 'Luxações múltiplas dos dedos'),
('S63.3', 'Ruptura traumática de ligamento do punho e do carpo'),
('S63.4', 'Ruptura traumática de ligamento do dedo ao nível das articulações metacarpofalangiana e interfalangiana'),
('S63.5', 'Entorse e distensão do punho'),
('S63.6', 'Entorse e distensão de dedo da mão'),
('S63.7', 'Entorse e distensão de outras partes e das não especificadas da mão')
ON CONFLICT (codigo) DO NOTHING;
