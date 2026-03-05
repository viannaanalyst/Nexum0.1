-- Adiciona campo de data de início do contrato na tabela clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS start_date date;
