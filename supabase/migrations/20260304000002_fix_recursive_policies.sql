
-- Drop the recursive policies
DROP POLICY IF EXISTS "Members can view members of their company" ON organization_members;
DROP POLICY IF EXISTS "Company Admins can manage members" ON organization_members;

-- Re-create them using the SECURITY DEFINER function is_company_member
-- This avoids the infinite recursion loop
CREATE POLICY "Members can view members of their company" ON organization_members
  FOR SELECT USING (
    is_company_member(company_id)
  );

CREATE POLICY "Company Admins can manage members" ON organization_members
  FOR ALL USING (
    exists (
      select 1 from organization_members m
      where m.user_id = auth.uid()
      and m.company_id = organization_members.company_id
      and m.role = 'admin'
    )
  );
