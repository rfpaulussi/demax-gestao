-- Dorsopatias M54 (série completa) — faltavam vários subcódigos usados na prática
INSERT INTO cid_referencia (codigo, descricao) VALUES
('M54',   'Dorsalgia'),
('M54.0', 'Panicullite atingindo o pescoço e o dorso'),
('M54.1', 'Radiculopatia'),
('M54.2', 'Cervicalgia'),
('M54.3', 'Ciática'),
('M54.6', 'Dor na coluna torácica'),
('M54.8', 'Outras dorsalgias'),
('M54.9', 'Dorsalgia não especificada')
ON CONFLICT (codigo) DO NOTHING;

-- Efeitos tóxicos de produtos químicos de limpeza (T54-T59) — misturas geram gases corrosivos
INSERT INTO cid_referencia (codigo, descricao) VALUES
('T54',   'Efeito tóxico de substâncias corrosivas'),
('T54.1', 'Efeito tóxico de outros ácidos e substâncias corrosivas'),
('T54.3', 'Efeito tóxico de álcalis cáusticos e substâncias corrosivas'),
('T54.9', 'Efeito tóxico de substância corrosiva não especificada'),
('T55',   'Efeito tóxico de sabões e detergentes'),
('T56',   'Efeito tóxico de metais'),
('T59',   'Efeito tóxico de outros gases, fumaças e vapores'),
('T59.9', 'Efeito tóxico de gases, fumaças e vapores não especificados')
ON CONFLICT (codigo) DO NOTHING;

-- Contato com animais peçonhentos/venenosos e outras substâncias (áreas verdes)
INSERT INTO cid_referencia (codigo, descricao) VALUES
('T63',   'Efeito tóxico do contato com animais venenosos'),
('T63.4', 'Efeito tóxico de veneno de outros artrópodes'),
('T63.9', 'Efeito tóxico de contato com animal venenoso não especificado'),
('T65',   'Efeito tóxico de outras substâncias e das não especificadas'),
('T65.9', 'Efeito tóxico de substância não especificada')
ON CONFLICT (codigo) DO NOTHING;

-- Efeitos adversos / reações alérgicas não classificadas em outra parte
INSERT INTO cid_referencia (codigo, descricao) VALUES
('T78',   'Efeitos adversos não classificados em outra parte'),
('T78.2', 'Choque anafilático não especificado'),
('T78.4', 'Alergia não especificada')
ON CONFLICT (codigo) DO NOTHING;

-- Nexo ocupacional: exposição química de limpeza e trabalho externo em áreas verdes
UPDATE cid_referencia SET nexo_ocupacional_limpeza = true
WHERE codigo IN (
  'M54','M54.0','M54.1','M54.2','M54.3','M54.6','M54.8','M54.9',
  'T54','T54.1','T54.3','T54.9','T55','T56','T59','T59.9',
  'T63','T63.4','T63.9','T65','T65.9',
  'T78','T78.2','T78.4'
);
