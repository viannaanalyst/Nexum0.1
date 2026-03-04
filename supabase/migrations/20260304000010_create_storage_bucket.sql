-- Create storage bucket for kanban attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('kanban-attachments', 'kanban-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'kanban-attachments');

-- Policy to allow public to view files (since we made it public, but good to be explicit or if we turn off public)
-- Actually, if public=true, we don't strictly need SELECT policy for public access via public URL, 
-- but for authenticated access via SDK it's good.
CREATE POLICY "Anyone can view files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'kanban-attachments');

-- Policy to allow users to update their own files
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (auth.uid() = owner)
WITH CHECK (bucket_id = 'kanban-attachments');

-- Policy to allow users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (auth.uid() = owner AND bucket_id = 'kanban-attachments');
