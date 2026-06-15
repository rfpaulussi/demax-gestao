-- ─── 1. Ampliar CHECK de tipo em historico_funcionarios ──────────────────────
-- O nome padrão gerado pelo Postgres é historico_funcionarios_tipo_check.
-- IF EXISTS protege caso o nome real difira.

ALTER TABLE historico_funcionarios
  DROP CONSTRAINT IF EXISTS historico_funcionarios_tipo_check;

ALTER TABLE historico_funcionarios
  ADD CONSTRAINT historico_funcionarios_tipo_check
  CHECK (tipo IN (
    'admissao', 'desligamento', 'mudanca_posto', 'mudanca_funcao',
    'ferias', 'atestado', 'falta', 'advertencia', 'suspensao',
    'cobertura_insalubre', 'transferencia', 'reativacao',
    'afastamento', 'retorno_afastamento'
  ));

-- ─── 2. Recriar função do trigger com os dois novos blocos ───────────────────

CREATE OR REPLACE FUNCTION trg_fn_historico_funcionarios_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Desligamento: status muda para 'desligado'
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'desligado' THEN
    INSERT INTO historico_funcionarios
      (funcionario_id, tipo, data_evento, descricao, dados_anteriores, dados_novos, registrado_por)
    VALUES (
      NEW.id,
      'desligamento',
      COALESCE(NEW.data_desligamento, CURRENT_DATE),
      'Funcionário desligado',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object(
        'status',           NEW.status,
        'data_desligamento',NEW.data_desligamento
      ),
      auth.uid()
    );
  END IF;

  -- Reativação: status muda de 'desligado' para outro
  IF OLD.status = 'desligado' AND NEW.status IS DISTINCT FROM 'desligado' THEN
    INSERT INTO historico_funcionarios
      (funcionario_id, tipo, data_evento, descricao, dados_anteriores, dados_novos, registrado_por)
    VALUES (
      NEW.id,
      'reativacao',
      CURRENT_DATE,
      'Funcionário reativado (status: ' || COALESCE(NEW.status, '—') || ')',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      auth.uid()
    );
  END IF;

  -- Mudança de função
  IF OLD.funcao_id IS DISTINCT FROM NEW.funcao_id THEN
    INSERT INTO historico_funcionarios
      (funcionario_id, tipo, data_evento, descricao, dados_anteriores, dados_novos, registrado_por)
    VALUES (
      NEW.id,
      'mudanca_funcao',
      CURRENT_DATE,
      'Função alterada',
      jsonb_build_object('funcao_id', OLD.funcao_id),
      jsonb_build_object('funcao_id', NEW.funcao_id),
      auth.uid()
    );
  END IF;

  -- Mudança de posto
  IF OLD.posto_id IS DISTINCT FROM NEW.posto_id THEN
    INSERT INTO historico_funcionarios
      (funcionario_id, tipo, data_evento, descricao, dados_anteriores, dados_novos, registrado_por)
    VALUES (
      NEW.id,
      'mudanca_posto',
      CURRENT_DATE,
      'Posto alterado',
      jsonb_build_object('posto_id', OLD.posto_id),
      jsonb_build_object('posto_id', NEW.posto_id),
      auth.uid()
    );
  END IF;

  -- Afastamento: status muda para 'afastado'
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'afastado' THEN
    INSERT INTO historico_funcionarios
      (funcionario_id, tipo, data_evento, descricao, dados_anteriores, dados_novos, registrado_por)
    VALUES (
      NEW.id,
      'afastamento',
      CURRENT_DATE,
      'Funcionário afastado',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status, 'motivo_afastamento', NEW.motivo_afastamento),
      auth.uid()
    );
  END IF;

  -- Retorno de afastamento: status sai de 'afastado'
  IF OLD.status = 'afastado' AND NEW.status IS DISTINCT FROM 'afastado' THEN
    INSERT INTO historico_funcionarios
      (funcionario_id, tipo, data_evento, descricao, dados_anteriores, dados_novos, registrado_por)
    VALUES (
      NEW.id,
      'retorno_afastamento',
      CURRENT_DATE,
      'Retorno de afastamento',
      jsonb_build_object('status', OLD.status, 'motivo_afastamento', OLD.motivo_afastamento),
      jsonb_build_object('status', NEW.status),
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;
