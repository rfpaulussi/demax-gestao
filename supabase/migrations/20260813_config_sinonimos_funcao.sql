-- Mapeia um nome de função como aparece na planilha do RH pro nome
-- correspondente cadastrado em `funcoes` neste sistema, quando os dois
-- lados usam rótulos diferentes pra mesma função (ex: RH chama
-- "AUX DE LIMPEZA - APRENDIZ", o sistema chama "JOVEM APRENDIZ").
-- Usado pela Conferência RH pra não sinalizar isso como divergência real.
CREATE TABLE IF NOT EXISTS config_sinonimos_funcao (
  funcao_rh       text PRIMARY KEY,
  funcao_sistema  text NOT NULL,
  created_at      timestamptz DEFAULT now()
);

INSERT INTO config_sinonimos_funcao (funcao_rh, funcao_sistema) VALUES
  ('AUX DE LIMPEZA - APRENDIZ', 'JOVEM APRENDIZ')
ON CONFLICT (funcao_rh) DO NOTHING;

ALTER TABLE config_sinonimos_funcao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_sinonimos_funcao_select" ON config_sinonimos_funcao
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "config_sinonimos_funcao_write_admin" ON config_sinonimos_funcao
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'admin')
  );
