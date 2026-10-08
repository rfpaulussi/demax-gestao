-- Agenda semanal dos supervisores (Fase 1). Aplicar no Supabase Studio (SQL Editor).
-- Acesso somente via service role nas Server Actions (RLS ligado, sem policies).

CREATE TABLE IF NOT EXISTS agenda_tipos_foco (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL UNIQUE,
  cor        text NOT NULL DEFAULT 'blue',
  icone      text NOT NULL DEFAULT '📌',
  ativo      boolean NOT NULL DEFAULT true,
  ordem      int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agenda_semanas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id uuid NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  semana_inicio date NOT NULL,
  status        text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','publicada')),
  publicada_em  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supervisor_id, semana_inicio)
);

CREATE TABLE IF NOT EXISTS agenda_blocos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id             uuid NOT NULL REFERENCES agenda_semanas(id) ON DELETE CASCADE,
  data                  date NOT NULL,
  periodo               text NOT NULL CHECK (periodo IN ('manha','tarde','noite')),
  tipo_foco_id          uuid NOT NULL REFERENCES agenda_tipos_foco(id),
  observacao            text,
  replanejado           boolean NOT NULL DEFAULT false,
  motivo_replanejamento text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (semana_id, data, periodo)
);

CREATE TABLE IF NOT EXISTS agenda_blocos_postos (
  bloco_id uuid NOT NULL REFERENCES agenda_blocos(id) ON DELETE CASCADE,
  posto_id uuid NOT NULL REFERENCES postos(id),
  PRIMARY KEY (bloco_id, posto_id)
);

CREATE TABLE IF NOT EXISTS agenda_comentarios (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id  uuid NOT NULL REFERENCES agenda_semanas(id) ON DELETE CASCADE,
  autor_id   uuid NOT NULL REFERENCES perfis(id),
  texto      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agenda_blocos_semana_idx ON agenda_blocos (semana_id);
CREATE INDEX IF NOT EXISTS agenda_comentarios_semana_idx ON agenda_comentarios (semana_id);

ALTER TABLE agenda_tipos_foco    ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_semanas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_blocos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_blocos_postos ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_comentarios   ENABLE ROW LEVEL SECURITY;

INSERT INTO agenda_tipos_foco (nome, cor, icone, ordem) VALUES
  ('Fiscalização de qualidade',   'emerald', '🔍', 1),
  ('Conferência de efetivo/ponto','blue',    '🧾', 2),
  ('Entrega de EPI/uniforme',     'orange',  '🦺', 3),
  ('Reunião com secretaria',      'violet',  '🤝', 4),
  ('Treinamento',                 'cyan',    '🎓', 5),
  ('Visita pós-ocorrência',       'rose',    '🚨', 6),
  ('Cobertura emergencial',       'amber',   '⚡', 7),
  ('Administrativo',              'slate',   '🗂️', 8)
ON CONFLICT (nome) DO NOTHING;
