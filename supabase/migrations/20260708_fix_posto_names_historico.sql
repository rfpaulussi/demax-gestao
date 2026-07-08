-- ============================================================
-- Fix: normaliza nomes de posto desnormalizados em historico_funcionarios
--
-- Problema: eventos de admissão e mudança de função importados
-- armazenavam nome do posto como texto livre em dados_novos/dados_anteriores.
-- O trigger de mudanca_posto guarda posto_id (UUID), que o prontuário
-- resolve para o nome canônico atual. Eventos com texto ficavam frozen
-- no nome do momento do import, gerando inconsistência no Histórico por Mês.
--
-- Solução: para cada registro com campo 'posto' como texto, tenta fazer
-- match com postos.nome (case-insensitive, trim) e substitui por
-- { posto_id, posto_nome } — igual ao formato dos eventos de trigger.
-- Registros sem match ficam intactos (sem perda de dados).
-- ============================================================

-- ─── 1. dados_novos: admissão e mudança de função ────────────

UPDATE historico_funcionarios h
SET dados_novos = (h.dados_novos - 'posto')
  || jsonb_build_object(
       'posto_id',   p.id::text,
       'posto_nome', p.nome
     )
FROM postos p
WHERE h.tipo IN ('admissao', 'mudanca_funcao')
  AND h.dados_novos IS NOT NULL
  AND h.dados_novos ? 'posto'
  AND NOT (h.dados_novos ? 'posto_id')
  AND LOWER(TRIM(h.dados_novos->>'posto')) = LOWER(TRIM(p.nome));

-- ─── 2. dados_anteriores: admissão e mudança de função ───────

UPDATE historico_funcionarios h
SET dados_anteriores = (h.dados_anteriores - 'posto')
  || jsonb_build_object(
       'posto_id',   p.id::text,
       'posto_nome', p.nome
     )
FROM postos p
WHERE h.tipo IN ('admissao', 'mudanca_funcao')
  AND h.dados_anteriores IS NOT NULL
  AND h.dados_anteriores ? 'posto'
  AND NOT (h.dados_anteriores ? 'posto_id')
  AND LOWER(TRIM(h.dados_anteriores->>'posto')) = LOWER(TRIM(p.nome));

-- ─── 3. Diagnóstico: lista registros que NÃO fizeram match ───
-- (executar separado para verificar; não altera nada)
--
-- SELECT h.id, h.tipo, h.data_evento, h.dados_novos->>'posto' AS posto_nao_resolvido
-- FROM historico_funcionarios h
-- WHERE h.tipo IN ('admissao', 'mudanca_funcao')
--   AND h.dados_novos ? 'posto'
--   AND NOT (h.dados_novos ? 'posto_id')
-- ORDER BY h.data_evento DESC;
