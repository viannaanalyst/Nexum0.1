-- Add priority column to support_tickets
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS priority text DEFAULT 'baixa' CHECK (priority IN ('baixa', 'media', 'alta'));
