-- 1. Adicionar colunas faltantes na tabela ferias existente
ALTER TABLE ferias
  ADD COLUMN IF NOT EXISTS numero_periodo integer,
  ADD COLUMN IF NOT EXISTS periodo_inicio date,
  ADD COLUMN IF NOT EXISTS periodo_fim date,
  ADD COLUMN IF NOT EXISTS limite_gozo date,
  ADD COLUMN IF NOT EXISTS dias_direito integer,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS dias_utilizados integer,
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES perfis(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Trigger updated_at (usa set_updated_at() já existente em 001_schema.sql)
CREATE TRIGGER update_ferias_updated_at
  BEFORE UPDATE ON ferias
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Sincronizar status do funcionário automaticamente
CREATE OR REPLACE FUNCTION sync_funcionario_status_ferias()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'em_curso' AND (OLD.status IS NULL OR OLD.status != 'em_curso') THEN
    UPDATE funcionarios SET status = 'ferias' WHERE id = NEW.funcionario_id;
  END IF;
  IF NEW.status IN ('concluida', 'cancelado') AND OLD.status = 'em_curso' THEN
    UPDATE funcionarios SET status = 'ativo' WHERE id = NEW.funcionario_id;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER sync_ferias_status
  AFTER UPDATE ON ferias
  FOR EACH ROW EXECUTE FUNCTION sync_funcionario_status_ferias();

-- 4. Ampliar CHECK de status para incluir 'cancelado'
DO $$
DECLARE v_conname text;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'ferias'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE ferias DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

ALTER TABLE ferias ADD CONSTRAINT ferias_status_check
  CHECK (status IN ('agendada', 'em_curso', 'concluida', 'cancelado'));

-- 5. RLS — apenas INSERT para supervisor (SELECT e ALL já cobertos em 002_rls.sql)
CREATE POLICY "ferias_supervisor_insert" ON ferias
  FOR INSERT TO authenticated
  WITH CHECK (
    is_supervisor()
    AND funcionario_id IN (
      SELECT id FROM funcionarios
      WHERE posto_id IN (SELECT get_supervisor_posto_ids())
    )
  );
