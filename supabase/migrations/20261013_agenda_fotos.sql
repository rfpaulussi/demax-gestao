-- Agenda Fase 3: foto opcional no check-in (temporária — apagada após 90 dias pelo cron).
-- Aplicar no Supabase Studio (SQL Editor).

ALTER TABLE agenda_checkins ADD COLUMN IF NOT EXISTS foto_path text;

-- Bucket privado: sem policies, só o service role (Server Actions) lê/escreve.
-- Acesso de leitura é feito por URL assinada temporária.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('agenda-checkins', 'agenda-checkins', false, 1048576, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;
