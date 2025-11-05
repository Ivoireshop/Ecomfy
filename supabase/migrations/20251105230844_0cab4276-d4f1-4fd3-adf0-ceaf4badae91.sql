-- Fix storage policies for testimonial images
-- Allow users to upload testimonial images to their own showcase sites

-- First, ensure the showcase-images bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('showcase-images', 'showcase-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can upload testimonial images to their showcase sites" ON storage.objects;
DROP POLICY IF EXISTS "Users can update testimonial images in their showcase sites" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete testimonial images from their showcase sites" ON storage.objects;
DROP POLICY IF EXISTS "Public can view all showcase images" ON storage.objects;

-- Allow users to upload testimonial images to their own showcase sites
CREATE POLICY "Users can upload testimonial images to their showcase sites"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'showcase-images' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM showcase_sites WHERE user_id = auth.uid()
  )
);

-- Allow users to update testimonial images in their showcase sites
CREATE POLICY "Users can update testimonial images in their showcase sites"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'showcase-images'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM showcase_sites WHERE user_id = auth.uid()
  )
);

-- Allow users to delete testimonial images from their showcase sites
CREATE POLICY "Users can delete testimonial images from their showcase sites"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'showcase-images'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM showcase_sites WHERE user_id = auth.uid()
  )
);

-- Allow public access to view all showcase images
CREATE POLICY "Public can view all showcase images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'showcase-images');