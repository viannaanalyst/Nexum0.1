
-- Create clients table
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Data Tab
  name text NOT NULL,
  email text,
  phone text,
  website text,
  instagram text,
  briefing text,
  
  -- Financial Tab
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'canceled')),
  mrr numeric(10,2) DEFAULT 0,
  due_day integer CHECK (due_day >= 1 AND due_day <= 31),
  payment_reminder boolean DEFAULT false,
  
  -- Scope Tab
  services text[], -- Array of strings
  scope_description text,
  
  -- Strategy Tab
  strategic_goals text[],
  access_credentials jsonb DEFAULT '[]', -- Array of objects { channel, login, password, obs }
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create client_team table (Many-to-Many)
CREATE TABLE client_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, user_id)
);

-- Create client_logs table
CREATE TABLE client_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  previous_status text,
  new_status text,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_logs ENABLE ROW LEVEL SECURITY;

-- Policies for clients
CREATE POLICY "Super Admin access clients" ON clients FOR ALL USING (is_super_admin());
CREATE POLICY "Members view company clients" ON clients FOR SELECT USING (is_company_member(company_id));
CREATE POLICY "Admins manage company clients" ON clients FOR ALL USING (is_company_admin(company_id));

-- Policies for client_team
CREATE POLICY "Super Admin access client_team" ON client_team FOR ALL USING (is_super_admin());
CREATE POLICY "Members view client_team" ON client_team FOR SELECT USING (
  EXISTS (SELECT 1 FROM clients c WHERE c.id = client_team.client_id AND is_company_member(c.company_id))
);
CREATE POLICY "Admins manage client_team" ON client_team FOR ALL USING (
  EXISTS (SELECT 1 FROM clients c WHERE c.id = client_team.client_id AND is_company_admin(c.company_id))
);

-- Policies for client_logs
CREATE POLICY "Super Admin access client_logs" ON client_logs FOR ALL USING (is_super_admin());
CREATE POLICY "Members view client_logs" ON client_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM clients c WHERE c.id = client_logs.client_id AND is_company_member(c.company_id))
);
-- Logs are inserted via application logic or triggers, but let's allow admins to insert for now
CREATE POLICY "Admins insert client_logs" ON client_logs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM clients c WHERE c.id = client_logs.client_id AND is_company_admin(c.company_id))
);
