-- Adicionar ON DELETE CASCADE na chave estrangeira parent_id da tabela kanban_cards
-- Isso permite a exclusão de cards que possuem subtarefas

DO $$ 
BEGIN
    -- Remover a constraint existente se existir
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'kanban_cards_parent_id_fkey' 
        AND table_name = 'kanban_cards'
    ) THEN
        ALTER TABLE kanban_cards DROP CONSTRAINT kanban_cards_parent_id_fkey;
    END IF;

    -- Adicionar a nova constraint com ON DELETE CASCADE
    ALTER TABLE kanban_cards 
    ADD CONSTRAINT kanban_cards_parent_id_fkey 
    FOREIGN KEY (parent_id) 
    REFERENCES kanban_cards(id) 
    ON DELETE CASCADE;
END $$;
