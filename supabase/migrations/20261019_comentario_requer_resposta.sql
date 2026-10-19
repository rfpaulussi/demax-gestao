-- Mensagem "só informar": não cria pendência de resposta para o outro lado.
-- Padrão true: toda mensagem existente continua pedindo resposta, como antes.
ALTER TABLE ocorrencia_comentarios
  ADD COLUMN IF NOT EXISTS requer_resposta boolean NOT NULL DEFAULT true;
