-- Create profiles bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('profiles', 'profiles', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload their own profile picture
CREATE POLICY "Users can upload their own profile picture"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profiles' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy to allow anyone to view profile pictures
CREATE POLICY "Anyone can view profile pictures"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profiles');

-- Policy to allow users to update their own profile picture
CREATE POLICY "Users can update their own profile picture"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profiles' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy to allow users to delete their own profile picture
CREATE POLICY "Users can delete their own profile picture"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profiles' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Add avatar_url column to profiles if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'avatar_url') THEN
    ALTER TABLE profiles ADD COLUMN avatar_url text;
  END IF;
END $$;
