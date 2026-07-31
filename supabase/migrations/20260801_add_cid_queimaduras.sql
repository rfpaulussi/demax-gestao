-- Queimaduras e corrosões (T20-T32) — calor, produtos químicos corrosivos, exposição solar
INSERT INTO cid_referencia (codigo, descricao) VALUES
('T20',   'Queimadura e corrosão da cabeça e pescoço'),
('T20.0', 'Queimadura de espessura não especificada da cabeça e pescoço'),
('T21',   'Queimadura e corrosão do tronco'),
('T21.0', 'Queimadura de espessura não especificada do tronco'),
('T22',   'Queimadura e corrosão do ombro e membro superior, exceto punho e mão'),
('T22.0', 'Queimadura de espessura não especificada do ombro e membro superior'),
('T23',   'Queimadura e corrosão do punho e da mão'),
('T23.0', 'Queimadura de espessura não especificada do punho e da mão'),
('T24',   'Queimadura e corrosão do quadril e membro inferior, exceto tornozelo e pé'),
('T24.0', 'Queimadura de espessura não especificada do quadril e membro inferior'),
('T25',   'Queimadura e corrosão do tornozelo e do pé'),
('T25.0', 'Queimadura de espessura não especificada do tornozelo e do pé'),
('T26',   'Queimadura e corrosão limitadas ao olho e anexos'),
('T26.0', 'Queimadura da pálpebra e da região periocular'),
('T26.1', 'Queimadura da córnea e do saco conjuntival'),
('T27',   'Queimadura e corrosão do trato respiratório'),
('T27.0', 'Queimadura da laringe e da traqueia'),
('T28',   'Queimadura e corrosão de outros órgãos internos'),
('T30',   'Queimadura e corrosão, região do corpo não especificada'),
('T30.0', 'Queimadura de espessura não especificada, região do corpo não especificada'),
('T31',   'Queimaduras classificadas segundo a extensão da superfície corporal atingida'),
('T31.0', 'Queimaduras que atingem menos de 10% da superfície corporal'),
('T31.1', 'Queimaduras que atingem de 10-19% da superfície corporal'),
('T32',   'Corrosões classificadas segundo a extensão da superfície corporal atingida'),
('T32.0', 'Corrosões que atingem menos de 10% da superfície corporal')
ON CONFLICT (codigo) DO NOTHING;

-- Nexo ocupacional: calor, produtos químicos corrosivos e exposição solar (limpeza/áreas verdes)
UPDATE cid_referencia SET nexo_ocupacional_limpeza = true
WHERE codigo IN (
  'T20','T20.0','T21','T21.0','T22','T22.0','T23','T23.0',
  'T24','T24.0','T25','T25.0','T26','T26.0','T26.1',
  'T27','T27.0','T28','T30','T30.0',
  'T31','T31.0','T31.1','T32','T32.0'
);
