-- Add metadata column to notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Add INSERT policy to notifications
-- Allowing any authenticated user to insert a notification (to notify others)
CREATE POLICY "Users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create user_notification_settings table
CREATE TABLE IF NOT EXISTS user_notification_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  new_tasks boolean DEFAULT true,
  due_dates boolean DEFAULT true,
  comments boolean DEFAULT true,
  status_changes boolean DEFAULT true,
  approvals boolean DEFAULT true,
  email_notifications boolean DEFAULT true,
  browser_notifications boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_notification_settings ENABLE ROW LEVEL SECURITY;

-- Policies for user_notification_settings
CREATE POLICY "Users can view their own settings"
  ON user_notification_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON user_notification_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can modify their own settings"
  ON user_notification_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Everyone can view other users' settings (needed to check preference before sending)
-- Or more restrictive: only users in the same company
CREATE POLICY "Users can view others settings to check preferences"
  ON user_notification_settings FOR SELECT
  USING (true);
