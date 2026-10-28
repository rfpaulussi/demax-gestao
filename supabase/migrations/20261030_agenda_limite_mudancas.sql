-- Agenda: limite de mudanças depois de publicada (3 por semana) e pedidos de mudança extra.
-- Seguro rodar mais de uma vez.

-- Mudanças feitas pelo supervisor depois de publicar (focos com posto) e mudanças extras aprovadas pela gestão.
ALTER TABLE agenda_semanas ADD COLUMN IF NOT EXISTS mudancas_pos_publicacao integer NOT NULL DEFAULT 0;
ALTER TABLE agenda_semanas ADD COLUMN IF NOT EXISTS mudancas_extras integer NOT NULL DEFAULT 0;

-- Pedido do supervisor para ultrapassar o limite. Aprovar libera +1 mudança na semana.
CREATE TABLE IF NOT EXISTS agenda_mudanca_pedidos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id     uuid NOT NULL REFERENCES agenda_semanas(id) ON DELETE CASCADE,
  supervisor_id uuid NOT NULL REFERENCES perfis(id),
  motivo        text NOT NULL,
  status        text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'recusado')),
  resposta      text,
  decidido_por  uuid REFERENCES perfis(id),
  decidido_em   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agenda_mudanca_pedidos_semana_idx ON agenda_mudanca_pedidos (semana_id, status);

-- Acesso só pelo servidor (service role), como as demais tabelas da agenda.
ALTER TABLE agenda_mudanca_pedidos ENABLE ROW LEVEL SECURITY;
