-- Inserir coluna "Concluído" para todas as empresas que não a possuem como global
DO $$
DECLARE
    company_record RECORD;
BEGIN
    FOR company_record IN SELECT id FROM companies
    LOOP
        -- Verifica se já existe uma coluna "Concluído" global para esta empresa
        IF NOT EXISTS (
            SELECT 1 FROM kanban_columns 
            WHERE company_id = company_record.id 
            AND title = 'Concluído' 
            AND client_id IS NULL
        ) THEN
            INSERT INTO kanban_columns (
                company_id,
                client_id,
                title,
                color,
                position,
                is_done_column
            ) VALUES (
                company_record.id,
                NULL,
                'Concluído',
                'emerald',
                99999,
                TRUE
            );
        END IF;
    END LOOP;
END $$;
