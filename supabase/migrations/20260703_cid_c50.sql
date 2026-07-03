-- CID C50 e derivados (neoplasia maligna da mama)
INSERT INTO cid_referencia (codigo, descricao) VALUES
  ('C50',   'Neoplasia maligna da mama'),
  ('C50.0', 'Neoplasia maligna do mamilo e aréola'),
  ('C50.1', 'Neoplasia maligna da porção central da mama'),
  ('C50.2', 'Neoplasia maligna do quadrante superior interno da mama'),
  ('C50.3', 'Neoplasia maligna do quadrante inferior interno da mama'),
  ('C50.4', 'Neoplasia maligna do quadrante superior externo da mama'),
  ('C50.5', 'Neoplasia maligna do quadrante inferior externo da mama'),
  ('C50.6', 'Neoplasia maligna da prolongação axilar da mama'),
  ('C50.8', 'Neoplasia maligna com lesão invasiva da mama'),
  ('C50.9', 'Neoplasia maligna da mama, não especificada')
ON CONFLICT (codigo) DO NOTHING;
