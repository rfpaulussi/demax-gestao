-- CID S01.5: Ferimento da boca e do lábio (sem subcategorias na CID-10)
INSERT INTO cid_referencia (codigo, descricao) VALUES
('S01',   'Ferimento da cabeça'),
('S01.5', 'Ferimento do lábio e da cavidade oral')
ON CONFLICT (codigo) DO NOTHING;
