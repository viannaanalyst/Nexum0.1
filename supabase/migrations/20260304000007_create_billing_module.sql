-- Histórico de notificações de cobrança
CREATE TABLE IF NOT EXISTS billing_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('reminder_3d', 'due_today', 'overdue')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  sent_by UUID REFERENCES auth.users(id)
);

-- Configurações de mensagens da régua (BillingConfig)
CREATE TABLE IF NOT EXISTS billing_configs (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  reminder_3d_msg TEXT,
  due_today_msg TEXT,
  overdue_msg TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE billing_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view billing notifications" ON billing_notifications
  FOR SELECT USING (is_company_member(company_id));

CREATE POLICY "Company admins can manage billing notifications" ON billing_notifications
  FOR ALL USING (is_company_admin(company_id));

CREATE POLICY "Company members can view billing configs" ON billing_configs
  FOR SELECT USING (is_company_member(company_id));

CREATE POLICY "Company admins can manage billing configs" ON billing_configs
  FOR ALL USING (is_company_admin(company_id));
