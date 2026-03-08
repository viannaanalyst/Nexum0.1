-- Create support_ticket_messages table for internal discussion on tickets
CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Policies for support_ticket_messages
CREATE POLICY "Users can view messages for their own tickets"
  ON support_ticket_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE id = support_ticket_messages.ticket_id
      AND (user_id = auth.uid() OR is_super_admin())
    )
  );

CREATE POLICY "Users can insert messages into their own tickets"
  ON support_ticket_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE id = ticket_id
      AND (user_id = auth.uid() OR is_super_admin())
    )
  );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_id ON support_ticket_messages(ticket_id);
