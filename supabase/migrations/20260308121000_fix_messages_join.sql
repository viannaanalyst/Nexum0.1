-- Add foreign key constraint to allow joining profiles with support_ticket_messages
ALTER TABLE support_ticket_messages
DROP CONSTRAINT IF EXISTS support_ticket_messages_user_id_fkey;

ALTER TABLE support_ticket_messages
ADD CONSTRAINT support_ticket_messages_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
