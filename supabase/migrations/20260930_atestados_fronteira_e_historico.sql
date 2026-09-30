-- ============================================================
-- 1) Trigger de sobreposição com a regra B: passagem de bastão de UM dia é permitida
--    (o anterior termina no dia em que o seguinte começa). Um dentro do outro, iguais ou
--    sobreposição de 2+ dias continuam barrados. Mesma regra de lib/atestados/periodos.ts.
-- 2) Linha do tempo (historico_funcionarios) passa a acompanhar edição e exclusão de atestado —
--    antes só havia trigger de INSERT, então datas editadas e atestados excluídos ficavam
--    congelados/órfãos na linha do tempo.
-- 3) Reparo único dos registros que já ficaram velhos ou órfãos.
-- ============================================================

-- ─── 1. Regra B no trigger de sobreposição ───────────────────

CREATE OR REPLACE FUNCTION atestados_sem_sobreposicao() RETURNS trigger AS $$
DECLARE conflito RECORD;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.funcionario_id = OLD.funcionario_id
     AND NEW.data_inicio = OLD.data_inicio
     AND NEW.data_fim = OLD.data_fim THEN
    RETURN NEW;
  END IF;

  SELECT id, data_inicio, data_fim INTO conflito
  FROM atestados
  WHERE funcionario_id = NEW.funcionario_id
    AND id <> NEW.id
    AND data_inicio <= NEW.data_fim
    AND data_fim >= NEW.data_inicio
    AND NOT (
      -- passagem de bastão: existente termina no dia em que o novo começa...
      (data_fim = NEW.data_inicio AND data_inicio < NEW.data_inicio AND data_fim < NEW.data_fim)
      -- ...ou o novo termina no dia em que o existente começa
      OR (NEW.data_fim = data_inicio AND NEW.data_inicio < data_inicio AND NEW.data_fim < data_fim)
    )
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Atestado sobreposto: já existe atestado de % a % para este funcionário',
      to_char(conflito.data_inicio, 'DD/MM/YYYY'), to_char(conflito.data_fim, 'DD/MM/YYYY')
      USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 2. Linha do tempo acompanha UPDATE/DELETE de atestado ───

CREATE OR REPLACE FUNCTION trg_fn_historico_atestados_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM historico_funcionarios
    WHERE ctid = (
      SELECT ctid FROM historico_funcionarios
      WHERE funcionario_id = OLD.funcionario_id
        AND tipo = 'atestado'
        AND data_evento = OLD.data_inicio
        AND dados_novos->>'data_fim' = OLD.data_fim::text
      LIMIT 1
    );
    RETURN OLD;
  END IF;

  -- UPDATE: só interessa se o período mudou
  IF NEW.funcionario_id = OLD.funcionario_id
     AND NEW.data_inicio = OLD.data_inicio
     AND NEW.data_fim = OLD.data_fim THEN
    RETURN NEW;
  END IF;

  UPDATE historico_funcionarios
  SET funcionario_id = NEW.funcionario_id,
      data_evento    = NEW.data_inicio,
      descricao      = 'Atestado: ' || to_char(NEW.data_inicio, 'DD/MM/YYYY') || ' a ' || to_char(NEW.data_fim, 'DD/MM/YYYY'),
      dados_novos    = jsonb_build_object('data_inicio', NEW.data_inicio, 'data_fim', NEW.data_fim)
  WHERE ctid = (
    SELECT ctid FROM historico_funcionarios
    WHERE funcionario_id = OLD.funcionario_id
      AND tipo = 'atestado'
      AND data_evento = OLD.data_inicio
      AND dados_novos->>'data_fim' = OLD.data_fim::text
    LIMIT 1
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_historico_atestados_sync ON atestados;
CREATE TRIGGER trg_historico_atestados_sync
  AFTER UPDATE OR DELETE ON atestados
  FOR EACH ROW EXECUTE FUNCTION trg_fn_historico_atestados_sync();

-- ─── 3. Reparo único (idempotente) ───────────────────────────
-- Eventos de atestado da linha do tempo que não têm atestado correspondente (datas editadas
-- antes deste trigger, ou atestado excluído). Conta por ocorrência: 2 eventos iguais e só 1
-- atestado = remove 1.
WITH ev AS (
  SELECT h.id, h.funcionario_id, h.data_evento, h.dados_novos->>'data_fim' AS fim,
         row_number() OVER (PARTITION BY h.funcionario_id, h.data_evento, h.dados_novos->>'data_fim'
                            ORDER BY h.created_at, h.id) AS rn
  FROM historico_funcionarios h
  WHERE h.tipo = 'atestado' AND h.dados_novos ? 'data_fim'
), qt AS (
  SELECT funcionario_id, data_inicio, data_fim::text AS fim, count(*) AS n
  FROM atestados GROUP BY funcionario_id, data_inicio, data_fim
)
DELETE FROM historico_funcionarios
WHERE id IN (
  SELECT ev.id
  FROM ev
  LEFT JOIN qt ON qt.funcionario_id = ev.funcionario_id AND qt.data_inicio = ev.data_evento AND qt.fim = ev.fim
  WHERE ev.rn > COALESCE(qt.n, 0)
);

-- Atestados sem evento correspondente (o período editado depois de criado) ganham o evento atual.
WITH at_rn AS (
  SELECT a.*, row_number() OVER (PARTITION BY a.funcionario_id, a.data_inicio, a.data_fim
                                 ORDER BY a.created_at, a.id) AS rn
  FROM atestados a
), ev_n AS (
  SELECT funcionario_id, data_evento, dados_novos->>'data_fim' AS fim, count(*) AS n
  FROM historico_funcionarios
  WHERE tipo = 'atestado' AND dados_novos ? 'data_fim'
  GROUP BY funcionario_id, data_evento, dados_novos->>'data_fim'
)
INSERT INTO historico_funcionarios (funcionario_id, tipo, data_evento, descricao, dados_novos, registrado_por)
SELECT a.funcionario_id, 'atestado', a.data_inicio,
       'Atestado: ' || to_char(a.data_inicio, 'DD/MM/YYYY') || ' a ' || to_char(a.data_fim, 'DD/MM/YYYY'),
       jsonb_build_object('data_inicio', a.data_inicio, 'data_fim', a.data_fim),
       a.registrado_por
FROM at_rn a
LEFT JOIN ev_n e ON e.funcionario_id = a.funcionario_id AND e.data_evento = a.data_inicio AND e.fim = a.data_fim::text
WHERE a.rn > COALESCE(e.n, 0)
  AND a.created_at >= '2026-06-10'; -- antes disso não havia trigger; a página já cobre esses casos
