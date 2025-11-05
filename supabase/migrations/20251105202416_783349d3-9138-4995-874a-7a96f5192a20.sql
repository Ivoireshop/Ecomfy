-- Create showcase_galleries table for managing multiple images per section
CREATE TABLE IF NOT EXISTS public.showcase_galleries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  showcase_site_id UUID NOT NULL REFERENCES public.showcase_sites(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL, -- 'author', 'formations', 'events', 'portfolio', 'custom'
  section_title TEXT,
  image_url TEXT NOT NULL,
  image_caption TEXT,
  image_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_galleries_site_section ON public.showcase_galleries(showcase_site_id, section_type);
CREATE INDEX IF NOT EXISTS idx_galleries_order ON public.showcase_galleries(showcase_site_id, section_type, image_order);

-- Enable RLS
ALTER TABLE public.showcase_galleries ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage galleries for their own showcase sites
CREATE POLICY "Users can manage their own showcase galleries"
ON public.showcase_galleries
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.showcase_sites
    WHERE showcase_sites.id = showcase_galleries.showcase_site_id
    AND showcase_sites.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.showcase_sites
    WHERE showcase_sites.id = showcase_galleries.showcase_site_id
    AND showcase_sites.user_id = auth.uid()
  )
);

-- Policy: Anyone can view galleries for published sites
CREATE POLICY "Anyone can view galleries for published sites"
ON public.showcase_galleries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.showcase_sites
    WHERE showcase_sites.id = showcase_galleries.showcase_site_id
    AND showcase_sites.is_published = true
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_galleries_updated_at
BEFORE UPDATE ON public.showcase_galleries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.showcase_galleries IS 'Stores multiple images for different sections of showcase sites';
COMMENT ON COLUMN public.showcase_galleries.section_type IS 'Type of section: author, formations, events, portfolio, custom';
COMMENT ON COLUMN public.showcase_galleries.image_order IS 'Display order of images within a section';