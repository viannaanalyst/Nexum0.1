
-- Disable RLS temporarily to debug
ALTER TABLE organization_members DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS but start with NO policies
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on organization_members
DROP POLICY IF EXISTS "Members can view members of their company" ON organization_members;
DROP POLICY IF EXISTS "Company Admins can manage members" ON organization_members;
DROP POLICY IF EXISTS "Super Admin can do everything on members" ON organization_members;

-- 1. Simple policy for Super Admin (no recursion)
CREATE POLICY "Super Admin Access" ON organization_members
  FOR ALL USING (
    (SELECT is_super_admin FROM profiles WHERE id = auth.uid())
  );

-- 2. Simple policy for Members (using SECURITY DEFINER function is_company_member)
-- This function MUST be SECURITY DEFINER to bypass RLS inside itself
CREATE OR REPLACE FUNCTION is_company_member(company_uuid uuid)
RETURNS boolean AS $$
BEGIN
  -- We query the table directly, but since this function is SECURITY DEFINER,
  -- it runs with owner privileges and bypasses RLS, avoiding recursion.
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
    AND company_id = company_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Member View Access" ON organization_members
  FOR SELECT USING (
    is_company_member(company_id)
  );

-- 3. Simple Admin policy (using SECURITY DEFINER function is_company_admin)
-- We need a separate function for admin check to avoid recursion in the admin policy too
CREATE OR REPLACE FUNCTION is_company_admin(company_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
    AND company_id = company_uuid
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Admin Manage Access" ON organization_members
  FOR ALL USING (
    is_company_admin(company_id)
  );
