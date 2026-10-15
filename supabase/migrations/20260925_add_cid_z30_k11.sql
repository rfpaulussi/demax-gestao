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
