-- Uma única solicitação pendente por funcionário e tipo (rede de segurança do bloqueio feito no código:
-- impede duplicata por clique duplo / envio simultâneo). Aplicar no Supabase Studio (SQL Editor).
-- Não altera dados. Se já houver duplicatas pendentes, o CREATE INDEX falha — rode antes a consulta abaixo
-- e rejeite/ajuste as sobras:
--
--   SELECT funcionario_id, tipo, count(*) FROM solicitacoes
--   WHERE status = 'pendente' AND funcionario_id IS NOT NULL
--     AND tipo::text IN ('desligamento','transferencia','mudanca_funcao','afastamento',
--                        'retorno_afastamento','rescisao_indireta','mudanca_horario')
--   GROUP BY 1, 2 HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS solicitacoes_pendente_unica_idx
  ON solicitacoes (funcionario_id, tipo)
  WHERE status = 'pendente'
    AND funcionario_id IS NOT NULL
    AND tipo::text IN ('desligamento','transferencia','mudanca_funcao','afastamento',
                       'retorno_afastamento','rescisao_indireta','mudanca_horario');
