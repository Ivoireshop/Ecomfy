-- Create table for showcase versions history
CREATE TABLE public.showcase_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  showcase_site_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  version_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  
  -- Snapshot of all the data at that point
  business_name TEXT NOT NULL,
  business_description TEXT,
  owner_name TEXT NOT NULL,
  owner_photo_url TEXT,
  whatsapp_number TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  
  hero_title TEXT,
  hero_subtitle TEXT,
  about_title TEXT,
  about_description TEXT,
  cta_title TEXT,
  cta_description TEXT,
  
  formation_title TEXT,
  formation_description TEXT,
  formation_price TEXT,
  formation_image_url TEXT,
  
  theme TEXT DEFAULT 'professional',
  primary_color TEXT DEFAULT '#2563eb',
  secondary_color TEXT DEFAULT '#7c3aed',
  text_color TEXT DEFAULT '#000000',
  
  logo_url TEXT,
  hero_image_url TEXT,
  about_image_url TEXT,
  
  features JSONB DEFAULT '[]',
  formations JSONB DEFAULT '[]',
  formations_text_align TEXT DEFAULT 'center',
  
  about_layout TEXT DEFAULT 'side-by-side',
  gallery_text_position TEXT DEFAULT 'below',
  font_family TEXT DEFAULT 'poppins',
  theme_mode TEXT DEFAULT 'light',
  
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT[],
  og_image_url TEXT,
  og_type TEXT DEFAULT 'website',
  twitter_card TEXT DEFAULT 'summary_large_image',
  
  -- Store testimonials snapshot as well
  testimonials JSONB DEFAULT '[]'
);

-- Enable RLS
ALTER TABLE public.showcase_versions ENABLE ROW LEVEL SECURITY;

-- Users can view versions of their own showcase sites
CREATE POLICY "Users can view their own showcase versions"
ON public.showcase_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM showcase_sites
    WHERE showcase_sites.id = showcase_versions.showcase_site_id
    AND showcase_sites.user_id = auth.uid()
  )
);

-- Users can create versions for their own showcase sites
CREATE POLICY "Users can create versions for their own showcase sites"
ON public.showcase_versions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM showcase_sites
    WHERE showcase_sites.id = showcase_versions.showcase_site_id
    AND showcase_sites.user_id = auth.uid()
  )
  AND auth.uid() = created_by
);

-- Users can delete their own showcase versions
CREATE POLICY "Users can delete their own showcase versions"
ON public.showcase_versions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM showcase_sites
    WHERE showcase_sites.id = showcase_versions.showcase_site_id
    AND showcase_sites.user_id = auth.uid()
  )
);

-- Create index for faster queries
CREATE INDEX idx_showcase_versions_site_id ON public.showcase_versions(showcase_site_id);
CREATE INDEX idx_showcase_versions_created_at ON public.showcase_versions(created_at DESC);