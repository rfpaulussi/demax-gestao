-- Agenda: hora em que o servidor recebeu o check-in (diferente da hora em que o GPS foi lido no aparelho).
-- Serve para o prazo de 24 h da foto contar do recebimento, e não da captura: um check-in feito offline
-- e enviado dias depois ainda pode receber a foto.
-- Seguro rodar mais de uma vez. Check-ins antigos ficam sem valor (o sistema usa a hora da captura).

ALTER TABLE agenda_checkins ADD COLUMN IF NOT EXISTS recebido_em timestamptz;
ALTER TABLE agenda_checkins ALTER COLUMN recebido_em SET DEFAULT now();
