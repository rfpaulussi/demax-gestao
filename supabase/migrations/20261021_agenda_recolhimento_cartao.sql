-- Agenda: recolhimento de cartão de ponto (dia inteiro, sem postos, registro manual).
-- Renomeia "Coleta de Cartão de Ponto" e marca o foco como dia inteiro.
-- Separa o vínculo automático com a sede (usa_sede) da regra "sem posto" (sem_posto).
-- Seguro rodar mais de uma vez.

ALTER TABLE agenda_tipos_foco ADD COLUMN IF NOT EXISTS usa_sede boolean NOT NULL DEFAULT false;
ALTER TABLE agenda_tipos_foco ADD COLUMN IF NOT EXISTS dia_inteiro boolean NOT NULL DEFAULT false;

-- Check-in sede/base: vincula o posto SEDE automaticamente.
UPDATE agenda_tipos_foco SET usa_sede = true WHERE nome = 'Check-in Sede / Base';

-- Recolhimento: ocupa manhã e tarde, não pede posto nem check-in.
UPDATE agenda_tipos_foco
   SET nome = 'Recolhimento de Cartão de Ponto'
 WHERE nome = 'Coleta de Cartão de Ponto'
   AND NOT EXISTS (SELECT 1 FROM agenda_tipos_foco WHERE nome = 'Recolhimento de Cartão de Ponto');

UPDATE agenda_tipos_foco
   SET sem_posto = true, dia_inteiro = true
 WHERE nome = 'Recolhimento de Cartão de Ponto';
