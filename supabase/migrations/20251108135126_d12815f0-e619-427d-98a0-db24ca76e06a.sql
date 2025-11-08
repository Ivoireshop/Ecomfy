-- Create storage bucket for generated ad images
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-images', 'generated-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own images
CREATE POLICY "Users can upload their own generated images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'generated-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own images
CREATE POLICY "Users can view their own generated images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'generated-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public access to generated images (for sharing)
CREATE POLICY "Public can view generated images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'generated-images');

-- Allow users to delete their own images
CREATE POLICY "Users can delete their own generated images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'generated-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);