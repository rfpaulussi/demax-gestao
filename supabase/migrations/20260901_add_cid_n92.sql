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
