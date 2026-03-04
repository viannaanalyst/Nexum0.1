-- Adicionar novos campos na tabela kanban_cards
ALTER TABLE kanban_cards 
ADD COLUMN IF NOT EXISTS subcategory TEXT,
ADD COLUMN IF NOT EXISTS show_on_calendar BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS category TEXT;

-- Garantir que temos policies para ver users (membros da equipe)
-- Geralmente isso é feito na tabela profiles ou auth.users, mas vamos assumir que podemos listar profiles via company_members
