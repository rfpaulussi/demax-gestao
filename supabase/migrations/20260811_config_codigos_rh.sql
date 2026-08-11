-- Mapeia o código de 6 dígitos que o RH usa na coluna CONTRATO da planilha
-- "ATIVOS MOGI" para o supervisor correspondente. Não é código de posto —
-- é convenção interna do RH e pode mudar de dono sem aviso, por isso fica
-- em tabela editável (não hardcoded) e não em `postos`.
CREATE TABLE IF NOT EXISTS config_codigos_rh (
  codigo        integer PRIMARY KEY,
  apelido       text NOT NULL,
  supervisor_id uuid REFERENCES perfis(id) ON DELETE SET NULL,
  updated_at    timestamptz DEFAULT now()
);

INSERT INTO config_codigos_rh (codigo, apelido) VALUES
  (70601, 'SIL'),
  (70602, 'HEB'),
  (70603, 'BRAZ'),
  (70604, 'PEDRO'),
  (70605, 'CRISL'),
  (70606, 'ROS'),
  (70607, 'CHRIS'),
  (706999, 'ADMIN')
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE config_codigos_rh ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_codigos_rh_select" ON config_codigos_rh
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "config_codigos_rh_write_admin" ON config_codigos_rh
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'admin')
  );
