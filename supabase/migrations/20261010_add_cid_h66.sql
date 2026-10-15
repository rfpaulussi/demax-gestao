-- CID H66: Otite média supurativa e as não especificadas
INSERT INTO cid_referencia (codigo, descricao) VALUES
('H66',   'Otite média supurativa e as não especificadas'),
('H66.0', 'Otite média aguda supurativa'),
('H66.1', 'Otite média tubotimpânica supurativa crônica'),
('H66.2', 'Otite média ático-antral supurativa crônica'),
('H66.3', 'Outras otites médias supurativas crônicas'),
('H66.4', 'Otite média supurativa, não especificada'),
('H66.9', 'Otite média, não especificada')
ON CONFLICT (codigo) DO NOTHING;
