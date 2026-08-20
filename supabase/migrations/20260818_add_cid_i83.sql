-- CID I83: Varizes dos membros inferiores
INSERT INTO cid_referencia (codigo, descricao) VALUES
('I83',   'Varizes dos membros inferiores'),
('I83.0', 'Varizes dos membros inferiores com úlcera'),
('I83.1', 'Varizes dos membros inferiores com inflamação'),
('I83.2', 'Varizes dos membros inferiores com úlcera e inflamação'),
('I83.9', 'Varizes dos membros inferiores sem úlcera ou inflamação')
ON CONFLICT (codigo) DO NOTHING;
