-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')), -- Receita or Despesa
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL, -- Ex: Tools, Marketing, Taxes, etc.
  due_date DATE NOT NULL,
  payment_date DATE,
  status TEXT NOT NULL CHECK (status IN ('paid', 'pending', 'overdue')) DEFAULT 'pending',
  recurrence TEXT NOT NULL CHECK (recurrence IN ('none', 'monthly')) DEFAULT 'none',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policies
-- We can reuse the is_company_member function if it exists, or is_company_admin.
-- Assuming is_company_member exists from previous migrations.

CREATE POLICY "Company members can view transactions" ON transactions
  FOR SELECT USING (
    is_company_member(company_id)
  );

CREATE POLICY "Company admins can manage transactions" ON transactions
  FOR ALL USING (
    is_company_admin(company_id)
  );
