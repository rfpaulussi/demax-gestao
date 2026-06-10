-- ============================================================
-- Migration: historico_funcionarios + triggers automáticos
-- Rodar no Supabase SQL Editor
-- ============================================================

-- ─── 1. Tabela ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS historico_funcionarios (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id   UUID        NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  tipo             TEXT        NOT NULL CHECK (tipo IN (
                                 'admissao', 'desligamento', 'mudanca_posto', 'mudanca_funcao',
                                 'ferias', 'atestado', 'falta', 'advertencia', 'suspensao',
                                 'cobertura_insalubre', 'transferencia', 'reativacao'
                               )),
  data_evento      DATE        NOT NULL,
  descricao        TEXT,
  dados_anteriores JSONB,
  dados_novos      JSONB,
  registrado_por   UUID        REFERENCES perfis(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. Índices ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_historico_funcionario_id
  ON historico_funcionarios (funcionario_id, data_evento DESC);

CREATE INDEX IF NOT EXISTS idx_historico_tipo
  ON historico_funcionarios (tipo);

CREATE INDEX IF NOT EXISTS idx_historico_data_evento
  ON historico_funcionarios (data_evento DESC);

-- ─── 3. RLS ──────────────────────────────────────────────────

ALTER TABLE historico_funcionarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access"
  ON historico_funcionarios
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── 4. Funções de trigger ────────────────────────────────────

-- 4.1 Férias
-- Colunas relevantes: funcionario_id, data_inicio, data_fim, status

CREATE OR REPLACE FUNCTION trg_fn_historico_ferias()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO historico_funcionarios
    (funcionario_id, tipo, data_evento, descricao, dados_novos, registrado_por)
  VALUES (
    NEW.funcionario_id,
    'ferias',
    NEW.data_inicio,
    'Férias: ' || to_char(NEW.data_inicio, 'DD/MM/YYYY') || ' a ' || to_char(NEW.data_fim, 'DD/MM/YYYY'),
    jsonb_build_object(
      'data_inicio',    NEW.data_inicio,
      'data_fim',       NEW.data_fim,
      'status',         NEW.status,
      'dias_direito',   NEW.dias_direito,
      'numero_periodo', NEW.numero_periodo
    ),
    auth.uid()
  );
  RETURN NEW;
END;
$$;

-- 4.2 Atestados
-- Colunas relevantes: funcionario_id, data_inicio, data_fim

CREATE OR REPLACE FUNCTION trg_fn_historico_atestados()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO historico_funcionarios
    (funcionario_id, tipo, data_evento, descricao, dados_novos, registrado_por)
  VALUES (
    NEW.funcionario_id,
    'atestado',
    NEW.data_inicio,
    'Atestado: ' || to_char(NEW.data_inicio, 'DD/MM/YYYY') || ' a ' || to_char(NEW.data_fim, 'DD/MM/YYYY'),
    jsonb_build_object(
      'data_inicio', NEW.data_inicio,
      'data_fim',    NEW.data_fim
    ),
    auth.uid()
  );
  RETURN NEW;
END;
$$;

-- 4.3 Faltas
-- Colunas: funcionario_id, data_falta, tipo, dias, observacao, tem_documento, justificativa

CREATE OR REPLACE FUNCTION trg_fn_historico_faltas()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO historico_funcionarios
    (funcionario_id, tipo, data_evento, descricao, dados_novos, registrado_por)
  VALUES (
    NEW.funcionario_id,
    'falta',
    NEW.data_falta,
    'Falta em ' || to_char(NEW.data_falta, 'DD/MM/YYYY') || ' (' || NEW.tipo || ')',
    jsonb_build_object(
      'data_falta',    NEW.data_falta,
      'tipo',          NEW.tipo,
      'dias',          NEW.dias,
      'tem_documento', NEW.tem_documento,
      'justificativa', NEW.justificativa,
      'observacao',    NEW.observacao
    ),
    auth.uid()
  );
  RETURN NEW;
END;
$$;

-- 4.4 Advertências
-- Colunas: funcionario_id, data_ocorrencia, grau, descricao, dias_suspensao, natureza, relato
-- Insere sempre 'advertencia'; se grau='suspensao', insere também 'suspensao'

CREATE OR REPLACE FUNCTION trg_fn_historico_advertencias()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Registro de advertência
  INSERT INTO historico_funcionarios
    (funcionario_id, tipo, data_evento, descricao, dados_novos, registrado_por)
  VALUES (
    NEW.funcionario_id,
    'advertencia',
    COALESCE(NEW.data_ocorrencia, CURRENT_DATE),
    'Advertência (' || COALESCE(NEW.grau, NEW.tipo, '—') || ')'
      || CASE WHEN NEW.descricao IS NOT NULL THEN ': ' || left(NEW.descricao, 120) ELSE '' END,
    jsonb_build_object(
      'grau',           NEW.grau,
      'tipo',           NEW.tipo,
      'data_ocorrencia',NEW.data_ocorrencia,
      'natureza',       NEW.natureza,
      'relato',         NEW.relato,
      'dias_suspensao', NEW.dias_suspensao,
      'status',         NEW.status
    ),
    auth.uid()
  );

  -- Registro adicional de suspensão
  IF NEW.grau = 'suspensao' THEN
    INSERT INTO historico_funcionarios
      (funcionario_id, tipo, data_evento, descricao, dados_novos, registrado_por)
    VALUES (
      NEW.funcionario_id,
      'suspensao',
      COALESCE(NEW.data_aplicacao, NEW.data_ocorrencia, CURRENT_DATE),
      'Suspensão de ' || COALESCE(NEW.dias_suspensao::TEXT, '?') || ' dia(s)',
      jsonb_build_object(
        'dias_suspensao',  NEW.dias_suspensao,
        'data_aplicacao',  NEW.data_aplicacao,
        'data_ocorrencia', NEW.data_ocorrencia
      ),
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 4.5 Insalubridade coberturas
-- Colunas: funcionario_id, data_cobertura, mes, ano, agente_ausente_nome, percentual, origem

CREATE OR REPLACE FUNCTION trg_fn_historico_insalubridade()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO historico_funcionarios
    (funcionario_id, tipo, data_evento, descricao, dados_novos, registrado_por)
  VALUES (
    NEW.funcionario_id,
    'cobertura_insalubre',
    NEW.data_cobertura,
    'Cobertura insalubre em ' || to_char(NEW.data_cobertura, 'DD/MM/YYYY')
      || CASE WHEN NEW.agente_ausente_nome IS NOT NULL
              THEN ' (ausente: ' || NEW.agente_ausente_nome || ')' ELSE '' END,
    jsonb_build_object(
      'data_cobertura',     NEW.data_cobertura,
      'mes',                NEW.mes,
      'ano',                NEW.ano,
      'agente_ausente_nome',NEW.agente_ausente_nome,
      'percentual',         NEW.percentual,
      'origem',             NEW.origem,
      'status',             NEW.status
    ),
    auth.uid()
  );
  RETURN NEW;
END;
$$;

-- 4.6 Funcionários: desligamento, mudança de função e mudança de posto
-- Uma função única dispara os três tipos de evento conforme o que mudou

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

  RETURN NEW;
END;
$$;

-- ─── 5. Triggers ─────────────────────────────────────────────

-- Garante idempotência: recria se já existir
DROP TRIGGER IF EXISTS trg_historico_ferias             ON ferias;
DROP TRIGGER IF EXISTS trg_historico_atestados          ON atestados;
DROP TRIGGER IF EXISTS trg_historico_faltas             ON faltas;
DROP TRIGGER IF EXISTS trg_historico_advertencias       ON advertencias;
DROP TRIGGER IF EXISTS trg_historico_insalubridade      ON insalubridade_coberturas;
DROP TRIGGER IF EXISTS trg_historico_funcionarios       ON funcionarios;

CREATE TRIGGER trg_historico_ferias
  AFTER INSERT ON ferias
  FOR EACH ROW EXECUTE FUNCTION trg_fn_historico_ferias();

CREATE TRIGGER trg_historico_atestados
  AFTER INSERT ON atestados
  FOR EACH ROW EXECUTE FUNCTION trg_fn_historico_atestados();

CREATE TRIGGER trg_historico_faltas
  AFTER INSERT ON faltas
  FOR EACH ROW EXECUTE FUNCTION trg_fn_historico_faltas();

CREATE TRIGGER trg_historico_advertencias
  AFTER INSERT ON advertencias
  FOR EACH ROW EXECUTE FUNCTION trg_fn_historico_advertencias();

CREATE TRIGGER trg_historico_insalubridade
  AFTER INSERT ON insalubridade_coberturas
  FOR EACH ROW EXECUTE FUNCTION trg_fn_historico_insalubridade();

CREATE TRIGGER trg_historico_funcionarios
  AFTER UPDATE ON funcionarios
  FOR EACH ROW EXECUTE FUNCTION trg_fn_historico_funcionarios_update();
