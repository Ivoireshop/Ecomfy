-- Migration: Ensure both 'shop-assets' and 'avatars' storage buckets exist and are public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('shop-assets', 'shop-assets', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']),
  ('avatars', 'avatars', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies for shop-assets
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access for shop-assets') THEN
    CREATE POLICY "Public Access for shop-assets" ON storage.objects FOR SELECT USING (bucket_id = 'shop-assets');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Upload for shop-assets') THEN
    CREATE POLICY "Public Upload for shop-assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'shop-assets');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Update for shop-assets') THEN
    CREATE POLICY "Public Update for shop-assets" ON storage.objects FOR UPDATE USING (bucket_id = 'shop-assets');
  END IF;
END $$;

-- Storage policies for avatars
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access for avatars') THEN
    CREATE POLICY "Public Access for avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Upload for avatars') THEN
    CREATE POLICY "Public Upload for avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Update for avatars') THEN
    CREATE POLICY "Public Update for avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars');
  END IF;
END $$;
