-- CID S83.5: Entorse e distensão envolvendo ligamento cruzado (anterior)(posterior) do joelho
-- e demais códigos da família S83 (lesões articulares/ligamentares do joelho)
INSERT INTO cid_referencia (codigo, descricao) VALUES
('S83',   'Luxação, entorse e distensão das articulações e dos ligamentos do joelho'),
('S83.0', 'Luxação da patela'),
('S83.1', 'Luxação do joelho'),
('S83.2', 'Ruptura de menisco, atual'),
('S83.3', 'Ruptura atual de cartilagem articular do joelho'),
('S83.4', 'Entorse e distensão envolvendo o ligamento colateral (interno)(externo) do joelho'),
('S83.5', 'Entorse e distensão envolvendo ligamento cruzado (anterior)(posterior) do joelho'),
('S83.6', 'Entorse e distensão de outras partes e de partes não especificadas do joelho'),
('S83.7', 'Traumatismo de vários componentes do joelho')
ON CONFLICT (codigo) DO NOTHING;
