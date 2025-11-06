-- Create storage bucket for generated content if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-content', 'generated-content', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload their own generated content" ON storage.objects;
DROP POLICY IF EXISTS "Public can view generated content" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own generated content" ON storage.objects;

-- Create policy to allow authenticated users to upload
CREATE POLICY "Users can upload their own generated content"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'generated-content' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy to allow public read access
CREATE POLICY "Public can view generated content"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'generated-content');

-- Create policy to allow users to delete their own content
CREATE POLICY "Users can delete their own generated content"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'generated-content'
  AND (storage.foldername(name))[1] = auth.uid()::text
);