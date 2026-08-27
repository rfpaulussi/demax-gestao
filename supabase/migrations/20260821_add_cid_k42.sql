-- CID K42: Hérnia umbilical
INSERT INTO cid_referencia (codigo, descricao) VALUES
('K42',   'Hérnia umbilical'),
('K42.0', 'Hérnia umbilical com obstrução, sem gangrena'),
('K42.1', 'Hérnia umbilical com gangrena'),
('K42.9', 'Hérnia umbilical sem obstrução ou gangrena')
ON CONFLICT (codigo) DO NOTHING;
