-- CID J39.9 (lido em atestado real), M45 e S50: não estavam em cid_referencia.
-- Sem eles, o atestado por foto lia o código mas não conseguia vinculá-lo a um CID cadastrado.
INSERT INTO cid_referencia (codigo, descricao) VALUES
('J39',   'Outras doenças das vias aéreas superiores'),
('J39.9', 'Doença não especificada das vias aéreas superiores'),
('M45',   'Espondilite ancilosante'),
('S50',   'Traumatismo superficial do antebraço')
ON CONFLICT (codigo) DO NOTHING;
