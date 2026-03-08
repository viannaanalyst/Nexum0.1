-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  title text NOT NULL,
  type text CHECK (type IN ('bug', 'melhoria')) NOT NULL,
  description text NOT NULL,
  page_url text,
  screenshot_url text,
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) NOT NULL,
  user_name text,
  company_name text
);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- 1. Policies for support_tickets
CREATE POLICY "Users can insert their own tickets" ON support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own tickets" ON support_tickets
  FOR SELECT USING (auth.uid() = user_id OR is_super_admin());

CREATE POLICY "Super Admin can update tickets" ON support_tickets
  FOR UPDATE USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Create storage bucket for support screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-tickets', 'support-tickets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for support-tickets bucket
CREATE POLICY "Authenticated users can upload screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'support-tickets');

CREATE POLICY "Anyone can view screenshots"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'support-tickets');

CREATE POLICY "Users can delete their own screenshots"
ON storage.objects FOR DELETE
TO authenticated
USING (auth.uid() = owner AND bucket_id = 'support-tickets');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_company_id ON support_tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
