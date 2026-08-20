-- CID R07: Dor de garganta e no peito
INSERT INTO cid_referencia (codigo, descricao) VALUES
('R07',   'Dor de garganta e no peito'),
('R07.0', 'Dor de garganta'),
('R07.1', 'Dor no peito ao respirar'),
('R07.2', 'Dor precordial'),
('R07.3', 'Outras dores no peito'),
('R07.4', 'Dor no peito, não especificada')
ON CONFLICT (codigo) DO NOTHING;
