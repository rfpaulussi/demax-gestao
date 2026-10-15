-- CID N80: Endometriose
INSERT INTO cid_referencia (codigo, descricao) VALUES
('N80',   'Endometriose'),
('N80.0', 'Endometriose do útero'),
('N80.1', 'Endometriose do ovário'),
('N80.2', 'Endometriose da trompa de Falópio'),
('N80.3', 'Endometriose do peritônio pélvico'),
('N80.4', 'Endometriose do septo retovaginal e da vagina'),
('N80.5', 'Endometriose do intestino'),
('N80.6', 'Endometriose em cicatriz cutânea'),
('N80.8', 'Outra endometriose'),
('N80.9', 'Endometriose, não especificada')
ON CONFLICT (codigo) DO NOTHING;
