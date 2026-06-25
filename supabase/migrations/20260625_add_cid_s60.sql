INSERT INTO cid_referencia (codigo, descricao) VALUES
('S60.0', 'Contusão do(s) dedo(s) sem lesão da unha'),
('S60.1', 'Contusão de dedo(s) com lesão da unha'),
('S60.2', 'Contusão de outras partes do punho e da mão'),
('S60.7', 'Traumatismos superficiais múltiplos do punho e da mão'),
('S60.8', 'Outros traumatismos superficiais do punho e da mão'),
('S60.9', 'Traumatismo superficial do punho e da mão não especificado'),
('S61.0', 'Ferimento de dedo(s) sem lesão da unha'),
('S61.1', 'Ferimento de dedo(s) com lesão da unha'),
('S62.0', 'Fratura do osso escafoide da mão'),
('S62.3', 'Fratura de metacarpo'),
('S62.5', 'Fratura do polegar'),
('S62.6', 'Fratura de outro dedo'),
('S63.6', 'Entorse e distensão de dedo da mão'),
('S66.0', 'Traumatismo do tendão flexor do polegar'),
('S67.0', 'Esmagamento do polegar e outro(s) dedo(s)'),
('S67.8', 'Esmagamento de outras partes do punho e mão'),
('S68.0', 'Amputação traumática do polegar'),
('S68.1', 'Amputação traumática de outro dedo único')
ON CONFLICT (codigo) DO NOTHING;

UPDATE cid_referencia SET nexo_ocupacional_limpeza = true
WHERE codigo IN (
  'S60.0','S60.1','S60.2','S60.7','S60.8','S60.9',
  'S61.0','S61.1','S62.0','S62.3','S62.5','S62.6',
  'S63.6','S66.0','S67.0','S67.8','S68.0','S68.1'
);
