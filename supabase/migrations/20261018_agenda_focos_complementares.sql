-- Agenda: focos de visita complementares (alinhados à lista usada pelos supervisores no dia a dia).
-- Seguro rodar mais de uma vez (não duplica). Requer a migração 20261015 (coluna exige_foto).

INSERT INTO agenda_tipos_foco (nome, cor, icone, ordem, exige_foto) VALUES
  ('Entrega de Material / Químicos',     'pink',   '📦', 9,  true),
  ('Tratamento de Piso / Limpeza Pesada','cyan',   '🧹', 10, true),
  ('Reunião com Direção / Gestor',       'indigo', '👔', 11, false),
  ('Ocorrência de Pessoal',              'amber',  '👤', 12, false),
  ('Check-in Sede / Base',               'slate',  '🏢', 13, false),
  ('Resolução de Ocorrência',            'rose',   '🛠️', 14, false),
  ('Coleta de Cartão de Ponto',          'blue',   '🕒', 15, false)
ON CONFLICT (nome) DO NOTHING;
