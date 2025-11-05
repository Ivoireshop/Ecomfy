-- Create storage bucket for showcase site images
INSERT INTO storage.buckets (id, name, public)
VALUES ('showcase-images', 'showcase-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for showcase images
CREATE POLICY "Anyone can view showcase images"
ON storage.objects FOR SELECT
USING (bucket_id = 'showcase-images');

CREATE POLICY "Users can upload their showcase images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'showcase-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their showcase images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'showcase-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their showcase images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'showcase-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add image columns to showcase_sites table
ALTER TABLE public.showcase_sites
ADD COLUMN logo_url text,
ADD COLUMN hero_image_url text,
ADD COLUMN about_image_url text;