-- Agenda: o foco "Check-in Sede / Base" passa a exigir foto no check-in.
-- Requer a migração 20261015 (coluna exige_foto). Seguro rodar mais de uma vez.
UPDATE agenda_tipos_foco SET exige_foto = true WHERE nome = 'Check-in Sede / Base';
