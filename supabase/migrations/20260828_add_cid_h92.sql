-- CID H92: Otalgia e secreção auditiva
INSERT INTO cid_referencia (codigo, descricao) VALUES
('H92',   'Otalgia e secreção auditiva'),
('H92.0', 'Otalgia'),
('H92.1', 'Otorreia'),
('H92.2', 'Otorragia')
ON CONFLICT (codigo) DO NOTHING;
