ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS recurrence_until DATE,
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES transactions(id) ON DELETE SET NULL;

COMMENT ON COLUMN transactions.recurrence_until IS 'Data final para a recorrência automática';
COMMENT ON COLUMN transactions.template_id IS 'ID do lançamento original que gerou esta instância recorrente';
