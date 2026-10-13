-- Agenda: local proposto pelo supervisor muito longe do endereço cadastrado (> 3 km).
-- Não troca o ponto oficial do posto: fica pendente até a coordenação aprovar ou rejeitar.
-- Acesso somente via service role nas Server Actions (RLS ligado, sem policies). Seguro rodar mais de uma vez.

CREATE TABLE IF NOT EXISTS postos_locais_propostos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posto_id              uuid NOT NULL REFERENCES postos(id) ON DELETE CASCADE,
  supervisor_id         uuid NOT NULL REFERENCES perfis(id),
  latitude              double precision NOT NULL,
  longitude             double precision NOT NULL,
  precisao_m            double precision,
  distancia_endereco_m  integer NOT NULL,
  justificativa         text NOT NULL,
  status                text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  decidido_por          uuid REFERENCES perfis(id),
  decidido_em           timestamptz
);

CREATE INDEX IF NOT EXISTS postos_locais_propostos_status_idx ON postos_locais_propostos (status, created_at);

ALTER TABLE postos_locais_propostos ENABLE ROW LEVEL SECURITY;
