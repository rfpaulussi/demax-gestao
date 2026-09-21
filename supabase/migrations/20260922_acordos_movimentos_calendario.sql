-- Acordos de compensação: campos estruturados, livro de movimentos e calendário de feriados de Mogi.
-- Aditiva: nenhuma coluna ou dado existente é alterado. Aplicar no Supabase Studio (SQL Editor).

ALTER TABLE acordos_compensacao
  ADD COLUMN IF NOT EXISTS evento_data date,
  ADD COLUMN IF NOT EXISTS evento_nome text,
  ADD COLUMN IF NOT EXISTS template_id text CHECK (template_id IN ('T1','T2','T3','T4','T5')),
  ADD COLUMN IF NOT EXISTS prazo_limite date,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','ia')),
  ADD COLUMN IF NOT EXISTS pedido_original text;

CREATE TABLE IF NOT EXISTS acordo_movimentos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acordo_id      uuid NOT NULL REFERENCES acordos_compensacao(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id),
  data           date NOT NULL,
  minutos        integer NOT NULL,
  papel          text NOT NULL CHECK (papel IN ('origem','quitacao')),
  status         text NOT NULL DEFAULT 'previsto'
                 CHECK (status IN ('previsto','cumprido','nao_cumprido','dispensado_ajuste')),
  observacao     text,
  verificado_em  timestamptz,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (acordo_id, funcionario_id, data, papel)
);
CREATE INDEX IF NOT EXISTS idx_acordo_movimentos_acordo ON acordo_movimentos (acordo_id);
CREATE INDEX IF NOT EXISTS idx_acordo_movimentos_func_data ON acordo_movimentos (funcionario_id, data);

ALTER TABLE acordo_movimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS acordo_movimentos_select ON acordo_movimentos;
CREATE POLICY acordo_movimentos_select ON acordo_movimentos
  FOR SELECT TO authenticated
  USING (
    is_admin_or_coord() OR is_viewer()
    OR funcionario_id IN (
      SELECT id FROM funcionarios WHERE posto_id IN (SELECT get_supervisor_posto_ids())
    )
  );
-- Escrita somente via service role (Server Actions com createAdminClient).

CREATE TABLE IF NOT EXISTS calendario_feriados (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data       date NOT NULL,
  nome       text NOT NULL,
  tipo       text NOT NULL CHECK (tipo IN ('nacional','estadual','municipal','facultativo')),
  ate_hora   time,
  base_legal text,
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (data, nome)
);

ALTER TABLE calendario_feriados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS calendario_feriados_select ON calendario_feriados;
CREATE POLICY calendario_feriados_select ON calendario_feriados
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS calendario_feriados_write ON calendario_feriados;
CREATE POLICY calendario_feriados_write ON calendario_feriados
  FOR ALL TO authenticated
  USING (is_admin_or_coord()) WITH CHECK (is_admin_or_coord());
