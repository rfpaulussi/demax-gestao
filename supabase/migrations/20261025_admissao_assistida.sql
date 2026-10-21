-- Admissão assistida (fase 1): campos de configuração, dados pessoais e rascunho do assistente.
-- Aplicar no Supabase Studio (SQL Editor). Tudo é aditivo e idempotente.

ALTER TABLE funcoes ADD COLUMN IF NOT EXISTS cbo text;
ALTER TABLE funcoes ADD COLUMN IF NOT EXISTS sindicato text;
ALTER TABLE postos  ADD COLUMN IF NOT EXISTS centro_custo text;

-- Dados pessoais e de admissão do funcionário. Preenchida quando a solicitação de admissão é aprovada.
CREATE TABLE IF NOT EXISTS funcionarios_dados_pessoais (
  funcionario_id   uuid PRIMARY KEY REFERENCES funcionarios(id) ON DELETE CASCADE,
  telefone         text,
  email            text,
  cep              text,
  logradouro       text,
  numero           text,
  complemento      text,
  bairro           text,
  cidade           text,
  uf               text,
  vt_utiliza       boolean,
  vt_linhas        jsonb,
  vt_cartao        text,
  vt_cartao_outro  text,
  uniforme         jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE funcionarios_dados_pessoais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS funcionarios_dados_pessoais_admin_all ON funcionarios_dados_pessoais;
CREATE POLICY funcionarios_dados_pessoais_admin_all ON funcionarios_dados_pessoais
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- Um rascunho do assistente por supervisor. Guarda CPF e endereço, por isso fica no banco (RLS do dono) e não no navegador.
CREATE TABLE IF NOT EXISTS admissao_rascunhos (
  supervisor_id uuid PRIMARY KEY REFERENCES perfis(id) ON DELETE CASCADE,
  dados         jsonb NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admissao_rascunhos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admissao_rascunhos_dono ON admissao_rascunhos;
CREATE POLICY admissao_rascunhos_dono ON admissao_rascunhos
  FOR ALL TO authenticated
  USING (supervisor_id = auth.uid())
  WITH CHECK (supervisor_id = auth.uid());
