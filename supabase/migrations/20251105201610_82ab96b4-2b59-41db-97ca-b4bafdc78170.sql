-- Add SEO fields to showcase_sites table
ALTER TABLE public.showcase_sites 
ADD COLUMN IF NOT EXISTS seo_title TEXT,
ADD COLUMN IF NOT EXISTS seo_description TEXT,
ADD COLUMN IF NOT EXISTS seo_keywords TEXT[],
ADD COLUMN IF NOT EXISTS og_image_url TEXT,
ADD COLUMN IF NOT EXISTS og_type TEXT DEFAULT 'website',
ADD COLUMN IF NOT EXISTS twitter_card TEXT DEFAULT 'summary_large_image';

-- Create analytics table for tracking visitors
CREATE TABLE IF NOT EXISTS public.showcase_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  showcase_site_id UUID NOT NULL REFERENCES public.showcase_sites(id) ON DELETE CASCADE,
  visitor_ip TEXT,
  visitor_country TEXT,
  visitor_city TEXT,
  user_agent TEXT,
  referrer TEXT,
  page_path TEXT,
  visited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session_id TEXT,
  device_type TEXT,
  browser TEXT
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_analytics_site_id ON public.showcase_analytics(showcase_site_id);
CREATE INDEX IF NOT EXISTS idx_analytics_visited_at ON public.showcase_analytics(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON public.showcase_analytics(session_id);

-- Enable RLS on analytics table
ALTER TABLE public.showcase_analytics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view analytics for their own showcase sites
CREATE POLICY "Users can view their own showcase analytics"
ON public.showcase_analytics
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.showcase_sites
    WHERE showcase_sites.id = showcase_analytics.showcase_site_id
    AND showcase_sites.user_id = auth.uid()
  )
);

-- Policy: Allow public insert for tracking (no auth required)
CREATE POLICY "Anyone can insert analytics"
ON public.showcase_analytics
FOR INSERT
WITH CHECK (true);

COMMENT ON TABLE public.showcase_analytics IS 'Tracks visitor analytics for showcase sites';
COMMENT ON COLUMN public.showcase_sites.seo_title IS 'Custom SEO title for search engines';
COMMENT ON COLUMN public.showcase_sites.seo_description IS 'Meta description for SEO';
COMMENT ON COLUMN public.showcase_sites.seo_keywords IS 'Keywords for SEO';
COMMENT ON COLUMN public.showcase_sites.og_image_url IS 'Open Graph image URL for social sharing';
COMMENT ON COLUMN public.showcase_sites.og_type IS 'Open Graph type (website, article, etc.)';
COMMENT ON COLUMN public.showcase_sites.twitter_card IS 'Twitter card type';