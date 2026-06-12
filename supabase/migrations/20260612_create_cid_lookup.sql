CREATE TABLE IF NOT EXISTS cid_referencia (
  codigo TEXT PRIMARY KEY,
  descricao TEXT NOT NULL
);

INSERT INTO cid_referencia (codigo, descricao) VALUES
('A09', 'Diarreia e gastroenterite'),
('B34.9', 'Infecção viral não especificada'),
('F32', 'Episódio depressivo'),
('F41.1', 'Transtorno de ansiedade generalizada'),
('G43', 'Migrânea/enxaqueca'),
('H10', 'Conjuntivite'),
('I10', 'Hipertensão arterial'),
('J00', 'Nasofaringite aguda (resfriado)'),
('J03', 'Amigdalite aguda'),
('J11', 'Influenza (gripe)'),
('J45', 'Asma'),
('K29', 'Gastrite e duodenite'),
('K52', 'Outras gastroenterites'),
('L03', 'Celulite (infecção de pele)'),
('M25.5', 'Dor articular'),
('M51', 'Transtornos de discos intervertebrais'),
('M54.4', 'Lumbago com ciática'),
('M54.5', 'Dor lombar baixa'),
('M65', 'Tenossinovite'),
('M75', 'Lesões do ombro (LER/DORT)'),
('M77', 'Outras entesopatias (LER/DORT)'),
('M79.1', 'Mialgia'),
('N39.0', 'Infecção urinária'),
('R10', 'Dor abdominal'),
('R51', 'Cefaleia'),
('S00-T98', 'Lesões/acidentes (especificar no relato)'),
('Z76.3', 'Acompanhante de paciente doente')
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE cid_referencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY cid_referencia_authenticated_select ON cid_referencia
  FOR SELECT TO authenticated USING (true);

ALTER TABLE atestados ADD COLUMN IF NOT EXISTS cid_codigo TEXT REFERENCES cid_referencia(codigo);
