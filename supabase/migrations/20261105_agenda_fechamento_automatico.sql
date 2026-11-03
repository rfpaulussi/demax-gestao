-- Agenda: fecha automaticamente a visita anterior quando o supervisor faz check-in de entrada
-- em outro posto sem antes registrar a saída. Marca o registro para cobrança da doutrina.
-- Seguro rodar mais de uma vez.

ALTER TABLE agenda_checkins ADD COLUMN IF NOT EXISTS fechamento_automatico boolean NOT NULL DEFAULT false;
