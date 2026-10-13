-- Agenda: foco "Check-in Sede / Base" sem seleção de posto.
-- O bloco desse foco vincula automaticamente o posto SEDE (ADM), e o check-in exige GPS dentro do raio.
-- Seguro rodar mais de uma vez.

-- Foco que não pede posto (o posto é definido pelo sistema).
ALTER TABLE agenda_tipos_foco ADD COLUMN IF NOT EXISTS sem_posto boolean NOT NULL DEFAULT false;
UPDATE agenda_tipos_foco SET sem_posto = true WHERE nome = 'Check-in Sede / Base';

-- Posto que representa a sede/base da administração.
ALTER TABLE postos ADD COLUMN IF NOT EXISTS sede_base boolean NOT NULL DEFAULT false;
UPDATE postos SET sede_base = true WHERE nome = 'SEDE';
