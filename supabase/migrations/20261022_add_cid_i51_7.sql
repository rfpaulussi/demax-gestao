-- CID I51.7: Cardiomegalia (sem subcategorias na CID-10)
INSERT INTO cid_referencia (codigo, descricao) VALUES
('I51',   'Complicações de cardiopatias e doenças cardíacas mal definidas'),
('I51.7', 'Cardiomegalia')
ON CONFLICT (codigo) DO NOTHING;
