-- Allow Company Admins to update their company record
CREATE POLICY "Company Admins can update their company" ON companies
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE user_id = auth.uid()
      AND company_id = companies.id
      AND role = 'admin'
      AND status = 'active'
    )
  );
