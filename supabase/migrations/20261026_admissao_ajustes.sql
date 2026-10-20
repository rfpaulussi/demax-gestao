-- Admissão assistida — ajustes após o primeiro teste. Aditivo e idempotente.
-- Aplicar no Supabase Studio (SQL Editor), depois da 20261025_admissao_assistida.sql.

-- 1) Centro de custo é do SUPERVISOR (70601–70607), não do posto.
ALTER TABLE perfis ADD COLUMN IF NOT EXISTS centro_custo text;

UPDATE perfis SET centro_custo = v.cc
FROM (VALUES
  ('SIL.',   '70601'),
  ('HEB.',   '70602'),
  ('BRAZ',   '70603'),
  ('PEDRO',  '70604'),
  ('CRISL.', '70605'),
  ('ROS.',   '70606'),
  ('CHRIS.', '70607')
) AS v(nome, cc)
WHERE perfis.role = 'supervisor' AND upper(trim(perfis.nome)) = v.nome;

-- postos.centro_custo (criada na migração anterior) fica sem uso e vazia. Não é removida aqui de propósito:
-- se este SQL rodasse antes do novo código subir, o código antigo ainda lê a coluna. Pode ser removida depois.

-- 2) Setor, CBO e sindicato por função (tabela do SST).
ALTER TABLE funcoes ADD COLUMN IF NOT EXISTS setor text;

UPDATE funcoes SET cbo = v.cbo, setor = v.setor
FROM (VALUES
  ('AGENTE DE HIGIENIZACAO A',    '5143-20', 'LIMPEZA - AMBIENTES INT. AREAS ESPECIFICAS'),
  ('AGENTE DE HIGIENIZACAO B',    '5143-20', 'AGENTE DE HIGIENIZACAO B'),
  ('AGENTE DE HIGIENIZACAO C',    '5143-20', 'AGENTE DE HIGIENIZACAO C'),
  ('AJUDANTE DE LIMPEZA',         '5143-20', 'LIMPEZA'),
  ('ASSISTENTE OPERACIONAL',      '4110-10', 'LIMPEZA- SUPERVISAO'),
  ('JOVEM APRENDIZ',              '5143-20', 'SEDE DEMAX - MOGI'),
  ('AUX DE LIMPEZA - APRENDIZ',   '5143-20', 'SEDE DEMAX - MOGI'),
  ('AUXILIAR ADMINISTRATIVO',     '4110-05', 'ADMINISTRAÇÃO GERAL'),
  ('AUXILIAR DE SUPERVISAO',      '4101-05', 'LIMPEZA- SUPERVISAO'),
  ('ENCARREGADO (A)',             '9922-10', 'LIMPEZA- SUPERVISAO'),
  ('LIDER DE LIMPEZA',            '4101-05', 'LIMPEZA- SUPERVISAO'),
  ('LIMPADOR DE VIDROS',          '5143-05', 'LIMPEZA - ALTURA'),
  ('LIMPADOR (A) DE VIDROS',      '5143-05', 'LIMPEZA - ALTURA'),
  ('SUPERVISOR (A) DE SERVICOS',  '4101-05', 'LIMPEZA- SUPERVISAO')
) AS v(nome, cbo, setor)
WHERE translate(upper(trim(funcoes.nome)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC') = v.nome;

-- Sindicato é o mesmo para todas as funções.
UPDATE funcoes SET sindicato = 'SIEMACO LIMPEZA' WHERE sindicato IS NULL OR trim(sindicato) = '';

-- 3) Catálogo de linhas de transporte: alimentado pelas admissões (o supervisor digita uma vez, as próximas já vêm sugeridas).
CREATE TABLE IF NOT EXISTS linhas_transporte (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave      text NOT NULL UNIQUE,   -- linha em minúsculas, sem espaços sobrando
  linha      text NOT NULL,
  tipo       text,
  empresa    text,
  valor      numeric(8,2),
  usos       integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE linhas_transporte ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS linhas_transporte_leitura ON linhas_transporte;
CREATE POLICY linhas_transporte_leitura ON linhas_transporte
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS linhas_transporte_admin ON linhas_transporte;
CREATE POLICY linhas_transporte_admin ON linhas_transporte
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());
