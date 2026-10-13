-- Agenda: foco "Audiência Trabalhista - Participação" (sem posto, registro manual).
-- Seguro rodar mais de uma vez.

INSERT INTO agenda_tipos_foco (nome, cor, icone, ordem, exige_foto, sem_posto) VALUES
  ('Audiência Trabalhista - Participação', 'rose', '⚖️', 16, false, true)
ON CONFLICT (nome) DO NOTHING;
