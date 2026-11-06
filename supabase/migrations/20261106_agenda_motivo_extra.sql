-- Motivo da visita extra (fora do plano do dia), informado pelo supervisor comum no check-in.
-- Aplicar no Supabase Studio (SQL Editor) antes de testar o check-in de visita extra.

ALTER TABLE agenda_checkins ADD COLUMN IF NOT EXISTS motivo_extra text;
