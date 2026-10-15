-- CID K42: Hérnia umbilical
INSERT INTO cid_referencia (codigo, descricao) VALUES
('K42',   'Hérnia umbilical'),
('K42.0', 'Hérnia umbilical com obstrução, sem gangrena'),
('K42.1', 'Hérnia umbilical com gangrena'),
('K42.9', 'Hérnia umbilical sem obstrução ou gangrena')
ON CONFLICT (codigo) DO NOTHING;
-- CID S83.5: Entorse e distensão envolvendo ligamento cruzado (anterior)(posterior) do joelho
-- e demais códigos da família S83 (lesões articulares/ligamentares do joelho)
INSERT INTO cid_referencia (codigo, descricao) VALUES
('S83',   'Luxação, entorse e distensão das articulações e dos ligamentos do joelho'),
('S83.0', 'Luxação da patela'),
('S83.1', 'Luxação do joelho'),
('S83.2', 'Ruptura de menisco, atual'),
('S83.3', 'Ruptura atual de cartilagem articular do joelho'),
('S83.4', 'Entorse e distensão envolvendo o ligamento colateral (interno)(externo) do joelho'),
('S83.5', 'Entorse e distensão envolvendo ligamento cruzado (anterior)(posterior) do joelho'),
('S83.6', 'Entorse e distensão de outras partes e de partes não especificadas do joelho'),
('S83.7', 'Traumatismo de vários componentes do joelho')
ON CONFLICT (codigo) DO NOTHING;
-- CID K01: Dentes inclusos e impactados (falta K01.0; K01.1 já cadastrado)
INSERT INTO cid_referencia (codigo, descricao) VALUES
('K01.0', 'Dentes inclusos')
ON CONFLICT (codigo) DO NOTHING;

-- CID K04: Doenças da polpa e dos tecidos periapicais
INSERT INTO cid_referencia (codigo, descricao) VALUES
('K04',   'Doenças da polpa e dos tecidos periapicais'),
('K04.0', 'Pulpite'),
('K04.1', 'Necrose da polpa'),
('K04.2', 'Degeneração da polpa'),
('K04.3', 'Formação anormal de tecido duro na polpa'),
('K04.4', 'Periodontite apical originada na polpa'),
('K04.5', 'Periodontite apical crônica'),
('K04.6', 'Abscesso periapical com fístula'),
('K04.7', 'Abscesso periapical sem fístula'),
('K04.8', 'Cisto radicular'),
('K04.9', 'Outras doenças e as não especificadas da polpa e dos tecidos periapicais')
ON CONFLICT (codigo) DO NOTHING;
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
-- CID H92: Otalgia e secreção auditiva
INSERT INTO cid_referencia (codigo, descricao) VALUES
('H92',   'Otalgia e secreção auditiva'),
('H92.0', 'Otalgia'),
('H92.1', 'Otorreia'),
('H92.2', 'Otorragia')
ON CONFLICT (codigo) DO NOTHING;
-- CID N92: Menstruação excessiva, frequente e irregular
INSERT INTO cid_referencia (codigo, descricao) VALUES
('N92',   'Menstruação excessiva, frequente e irregular'),
('N92.0', 'Menstruação excessiva e frequente com ciclo regular'),
('N92.1', 'Menstruação excessiva e frequente com ciclo irregular'),
('N92.2', 'Menstruação excessiva na puberdade'),
('N92.3', 'Sangramento da ovulação'),
('N92.4', 'Sangramento abundante na pré-menopausa'),
('N92.5', 'Outros tipos especificados de irregularidade da menstruação'),
('N92.6', 'Menstruação irregular, não especificada')
ON CONFLICT (codigo) DO NOTHING;
-- CID Z30: Anticoncepção (Z30.5 já cadastrado anteriormente)
INSERT INTO cid_referencia (codigo, descricao) VALUES
('Z30',   'Anticoncepção'),
('Z30.0', 'Aconselhamento geral sobre anticoncepção'),
('Z30.1', 'Inserção de dispositivo anticoncepcional (intra-uterino)'),
('Z30.2', 'Esterilização'),
('Z30.3', 'Extração menstrual'),
('Z30.4', 'Supervisão do uso de drogas anticoncepcionais'),
('Z30.8', 'Outros procedimentos anticoncepcionais'),
('Z30.9', 'Procedimento anticoncepcional não especificado')
ON CONFLICT (codigo) DO NOTHING;

-- CID K11: Doenças das glândulas salivares
INSERT INTO cid_referencia (codigo, descricao) VALUES
('K11',   'Doenças das glândulas salivares'),
('K11.0', 'Atrofia de glândula salivar'),
('K11.1', 'Hipertrofia de glândula salivar'),
('K11.2', 'Sialadenite'),
('K11.3', 'Abscesso de glândula salivar'),
('K11.4', 'Fístula de glândula salivar'),
('K11.5', 'Sialolitíase'),
('K11.6', 'Mucocele de glândula salivar'),
('K11.7', 'Alterações da secreção salivar'),
('K11.8', 'Outras doenças das glândulas salivares'),
('K11.9', 'Doença de glândula salivar, não especificada')
ON CONFLICT (codigo) DO NOTHING;
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
-- CID N20: Calculose do rim e do ureter
INSERT INTO cid_referencia (codigo, descricao) VALUES
('N20',   'Calculose do rim e do ureter'),
('N20.0', 'Calculose do rim'),
('N20.1', 'Calculose do ureter'),
('N20.2', 'Calculose do rim com calculose do ureter'),
('N20.9', 'Calculose urinária, não especificada')
ON CONFLICT (codigo) DO NOTHING;

-- CID S63: Luxação, entorse e distensão das articulações e dos ligamentos ao nível do punho e da mão
-- (S63.6 já cadastrado em 20260625_add_cid_s60.sql)
INSERT INTO cid_referencia (codigo, descricao) VALUES
('S63',   'Luxação, entorse e distensão das articulações e dos ligamentos ao nível do punho e da mão'),
('S63.0', 'Luxação do punho'),
('S63.1', 'Luxação do dedo'),
('S63.2', 'Luxações múltiplas dos dedos'),
('S63.3', 'Ruptura traumática de ligamento do punho e do carpo'),
('S63.4', 'Ruptura traumática de ligamento do dedo ao nível das articulações metacarpofalangiana e interfalangiana'),
('S63.5', 'Entorse e distensão do punho'),
('S63.6', 'Entorse e distensão de dedo da mão'),
('S63.7', 'Entorse e distensão de outras partes e das não especificadas da mão')
ON CONFLICT (codigo) DO NOTHING;
