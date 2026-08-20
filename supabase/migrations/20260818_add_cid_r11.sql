-- CID R11: Náusea e vômitos
INSERT INTO cid_referencia (codigo, descricao) VALUES
('R11',   'Náusea e vômitos'),
('R11.0', 'Náusea'),
('R11.1', 'Vômitos'),
('R11.2', 'Náusea com vômitos, não especificados')
ON CONFLICT (codigo) DO NOTHING;
