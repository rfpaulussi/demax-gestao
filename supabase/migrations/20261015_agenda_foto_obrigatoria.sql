-- Agenda: foco pode exigir foto para a visita contar como cumprida.
-- Aplicar no Supabase Studio (SQL Editor). Seguro rodar mais de uma vez.

ALTER TABLE agenda_tipos_foco ADD COLUMN IF NOT EXISTS exige_foto boolean NOT NULL DEFAULT false;

-- Sugestão inicial: focos de fiscalização e entrega de EPI exigem evidência fotográfica.
UPDATE agenda_tipos_foco
   SET exige_foto = true
 WHERE nome IN ('Fiscalização de qualidade', 'Entrega de EPI/uniforme');
