
-- Create company_partners table
CREATE TABLE company_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  percentage numeric(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE company_partners ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Super Admin can do everything on company_partners" ON company_partners
  FOR ALL USING (is_super_admin());

CREATE POLICY "Members can view partners of their company" ON company_partners
  FOR SELECT USING (
    is_company_member(company_id)
  );

CREATE POLICY "Company Admins can manage partners" ON company_partners
  FOR ALL USING (
    exists (
      select 1 from organization_members m
      where m.user_id = auth.uid()
      and m.company_id = company_partners.company_id
      and m.role = 'admin'
    )
  );
