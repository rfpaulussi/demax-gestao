-- CID H18: Outros transtornos da córnea
INSERT INTO cid_referencia (codigo, descricao) VALUES
('H18',   'Outros transtornos da córnea'),
('H18.0', 'Pigmentações e depósitos da córnea'),
('H18.1', 'Ceratopatia bolhosa'),
('H18.2', 'Outros edemas da córnea'),
('H18.3', 'Alterações das membranas da córnea'),
('H18.4', 'Degeneração da córnea'),
('H18.5', 'Distrofias hereditárias da córnea'),
('H18.6', 'Ceratocone'),
('H18.7', 'Outras deformidades da córnea'),
('H18.8', 'Outros transtornos especificados da córnea'),
('H18.9', 'Transtorno não especificado da córnea')
ON CONFLICT (codigo) DO NOTHING;
