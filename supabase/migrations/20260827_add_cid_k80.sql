-- CID K80: Colelitíase (T30.2 já cadastrado anteriormente)
INSERT INTO cid_referencia (codigo, descricao) VALUES
('K80',   'Colelitíase'),
('K80.0', 'Cálculo da vesícula biliar com colecistite aguda'),
('K80.1', 'Cálculo da vesícula biliar com outra colecistite'),
('K80.2', 'Cálculo da vesícula biliar sem colecistite'),
('K80.3', 'Cálculo do ducto biliar com colangite'),
('K80.4', 'Cálculo do ducto biliar com colecistite'),
('K80.5', 'Cálculo do ducto biliar sem colangite ou colecistite'),
('K80.8', 'Outras colelitíases')
ON CONFLICT (codigo) DO NOTHING;
