-- CID K05.0: Gengivite aguda (sem subcategorias na CID-10)
-- K05.3 já cadastrado em 20260821_add_cids_auditoria_sesmt.sql
INSERT INTO cid_referencia (codigo, descricao) VALUES
('K05',   'Gengivite e doenças periodontais'),
('K05.0', 'Gengivite aguda')
ON CONFLICT (codigo) DO NOTHING;
