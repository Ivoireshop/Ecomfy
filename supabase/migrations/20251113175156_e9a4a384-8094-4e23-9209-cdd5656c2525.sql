-- Ajouter colonnes vidéo dans showcase_sites
ALTER TABLE public.showcase_sites
ADD COLUMN IF NOT EXISTS hero_video_url text,
ADD COLUMN IF NOT EXISTS about_video_url text;

-- Créer bucket storage pour vidéos showcase
INSERT INTO storage.buckets (id, name, public)
VALUES ('showcase-videos', 'showcase-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Créer policies pour le bucket showcase-videos
CREATE POLICY "Anyone can view showcase videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'showcase-videos');

CREATE POLICY "Users can upload videos for their showcase sites"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'showcase-videos' AND
  auth.uid() IN (
    SELECT user_id FROM public.showcase_sites
    WHERE id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can update their showcase videos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'showcase-videos' AND
  auth.uid() IN (
    SELECT user_id FROM public.showcase_sites
    WHERE id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can delete their showcase videos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'showcase-videos' AND
  auth.uid() IN (
    SELECT user_id FROM public.showcase_sites
    WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Ajouter table pour gérer les vidéos de galerie
CREATE TABLE IF NOT EXISTS public.showcase_gallery_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  showcase_site_id uuid NOT NULL REFERENCES public.showcase_sites(id) ON DELETE CASCADE,
  section_type text NOT NULL,
  section_title text,
  video_url text NOT NULL,
  video_caption text,
  video_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on showcase_gallery_videos
ALTER TABLE public.showcase_gallery_videos ENABLE ROW LEVEL SECURITY;

-- RLS policies for showcase_gallery_videos
CREATE POLICY "Anyone can view gallery videos for published sites"
ON public.showcase_gallery_videos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.showcase_sites
    WHERE showcase_sites.id = showcase_gallery_videos.showcase_site_id
    AND showcase_sites.is_published = true
  )
);

CREATE POLICY "Users can manage their own showcase gallery videos"
ON public.showcase_gallery_videos FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.showcase_sites
    WHERE showcase_sites.id = showcase_gallery_videos.showcase_site_id
    AND showcase_sites.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.showcase_sites
    WHERE showcase_sites.id = showcase_gallery_videos.showcase_site_id
    AND showcase_sites.user_id = auth.uid()
  )
);