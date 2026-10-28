-- Supervisor de apoio: sem agenda, faz check-in em qualquer posto que visitar, informando a atividade.
-- Seguro rodar mais de uma vez.

-- Marca o perfil como supervisor de apoio.
ALTER TABLE perfis ADD COLUMN IF NOT EXISTS apoio boolean NOT NULL DEFAULT false;

-- Atividade informada no check-in de entrada do supervisor de apoio (mesmos focos da agenda).
ALTER TABLE agenda_checkins ADD COLUMN IF NOT EXISTS foco_id uuid REFERENCES agenda_tipos_foco(id);
ALTER TABLE agenda_checkins ADD COLUMN IF NOT EXISTS atividade_obs text;

-- Conferir o nome exato antes de marcar:
--   SELECT id, nome, email, role, apoio FROM perfis WHERE nome ILIKE '%braz%';
-- Marcar o Braz como supervisor de apoio:
UPDATE perfis SET apoio = true WHERE role = 'supervisor' AND nome ILIKE 'braz%';
