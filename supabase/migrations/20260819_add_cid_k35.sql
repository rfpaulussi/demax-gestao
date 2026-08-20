-- CID K35: Apendicite aguda
INSERT INTO cid_referencia (codigo, descricao) VALUES
('K35',   'Apendicite aguda'),
('K35.0', 'Apendicite aguda com peritonite generalizada'),
('K35.1', 'Apendicite aguda com abscesso peritoneal'),
('K35.9', 'Apendicite aguda sem outras especificações')
ON CONFLICT (codigo) DO NOTHING;
