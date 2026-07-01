-- Controle de leitura das notificações pelo supervisor
ALTER TABLE solicitacoes
  ADD COLUMN IF NOT EXISTS lida_supervisor boolean NOT NULL DEFAULT false;
