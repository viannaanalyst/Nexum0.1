-- Allow Super Admins to update any profile
CREATE POLICY "Super Admins can update any profile" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles AS p
      WHERE p.id = auth.uid()
      AND p.is_super_admin = true
    )
  );

-- Allow Company Admins to update profiles of members in their company
CREATE POLICY "Company Admins can update member profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members AS admin_member
      JOIN organization_members AS target_member ON admin_member.company_id = target_member.company_id
      WHERE admin_member.user_id = auth.uid()
      AND admin_member.role = 'admin'
      AND target_member.user_id = profiles.id
    )
  );
