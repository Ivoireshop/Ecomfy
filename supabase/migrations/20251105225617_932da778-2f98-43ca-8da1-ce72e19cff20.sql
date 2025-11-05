-- Create testimonials table for showcase sites
CREATE TABLE IF NOT EXISTS public.showcase_testimonials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  showcase_site_id UUID NOT NULL REFERENCES public.showcase_sites(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  testimonial_text TEXT NOT NULL,
  result_image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.showcase_testimonials ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage testimonials for their own showcase sites
CREATE POLICY "Users can manage their own showcase testimonials"
  ON public.showcase_testimonials
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.showcase_sites
      WHERE showcase_sites.id = showcase_testimonials.showcase_site_id
      AND showcase_sites.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.showcase_sites
      WHERE showcase_sites.id = showcase_testimonials.showcase_site_id
      AND showcase_sites.user_id = auth.uid()
    )
  );

-- Policy: Anyone can view testimonials for published sites
CREATE POLICY "Anyone can view testimonials for published sites"
  ON public.showcase_testimonials
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.showcase_sites
      WHERE showcase_sites.id = showcase_testimonials.showcase_site_id
      AND showcase_sites.is_published = true
    )
  );

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_showcase_testimonials_updated_at
  BEFORE UPDATE ON public.showcase_testimonials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better query performance
CREATE INDEX idx_showcase_testimonials_site_id ON public.showcase_testimonials(showcase_site_id);
CREATE INDEX idx_showcase_testimonials_display_order ON public.showcase_testimonials(showcase_site_id, display_order);