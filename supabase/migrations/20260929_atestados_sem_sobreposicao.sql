-- ============================================================
-- Atestado duplicado/sobreposto nunca entra: rede de segurança no banco.
-- A aplicação já checa antes (lib/atestados/sobreposicao.ts); este trigger cobre qualquer
-- caminho que escape (script, SQL manual, fluxo novo).
--
-- Só valida INSERT e UPDATE que mude data_inicio/data_fim/funcionario_id — atestados antigos que
-- já se sobrepõem continuam editáveis (CID, motivo) sem travar; o que não dá é criar/mover um
-- período para cima de outro atestado do mesmo funcionário.
-- ============================================================

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
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Atestado sobreposto: já existe atestado de % a % para este funcionário',
      to_char(conflito.data_inicio, 'DD/MM/YYYY'), to_char(conflito.data_fim, 'DD/MM/YYYY')
      USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_atestados_sem_sobreposicao ON atestados;
CREATE TRIGGER trg_atestados_sem_sobreposicao
  BEFORE INSERT OR UPDATE ON atestados
  FOR EACH ROW EXECUTE FUNCTION atestados_sem_sobreposicao();

-- Verificação: atestados que JÁ se sobrepõem hoje (o trigger não mexe neles; corrigir à mão)
SELECT a.funcionario_id, f.nome, a.id AS atestado_a, b.id AS atestado_b,
       a.data_inicio AS a_ini, a.data_fim AS a_fim, b.data_inicio AS b_ini, b.data_fim AS b_fim
FROM atestados a
JOIN atestados b ON a.funcionario_id = b.funcionario_id AND a.id < b.id
  AND a.data_inicio <= b.data_fim AND a.data_fim >= b.data_inicio
JOIN funcionarios f ON f.id = a.funcionario_id
ORDER BY f.nome, a.data_inicio;
