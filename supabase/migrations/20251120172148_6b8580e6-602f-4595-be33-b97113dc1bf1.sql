-- Create blog_posts table for managing blog articles
CREATE TABLE public.blog_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  showcase_site_id UUID NOT NULL REFERENCES public.showcase_sites(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  image_url TEXT,
  author_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Général',
  read_time_minutes INTEGER DEFAULT 5,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(showcase_site_id, slug)
);

-- Enable RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view published posts
CREATE POLICY "Published blog posts are viewable by everyone"
ON public.blog_posts
FOR SELECT
USING (is_published = true);

-- Policy: Site owners can manage their own posts
CREATE POLICY "Site owners can manage their blog posts"
ON public.blog_posts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.showcase_sites
    WHERE showcase_sites.id = blog_posts.showcase_site_id
    AND showcase_sites.user_id = auth.uid()
  )
);

-- Create index for better performance
CREATE INDEX idx_blog_posts_showcase_site ON public.blog_posts(showcase_site_id);
CREATE INDEX idx_blog_posts_published ON public.blog_posts(is_published, published_at DESC);
CREATE INDEX idx_blog_posts_slug ON public.blog_posts(showcase_site_id, slug);

-- Trigger for updated_at
CREATE TRIGGER update_blog_posts_updated_at
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();