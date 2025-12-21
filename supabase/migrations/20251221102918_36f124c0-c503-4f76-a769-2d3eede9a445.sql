-- Create image cache table for storing generated images
CREATE TABLE public.image_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_hash TEXT NOT NULL,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'gpt-image-1',
  platform TEXT,
  size TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  access_count INTEGER NOT NULL DEFAULT 1,
  user_id UUID REFERENCES auth.users(id)
);

-- Create index for fast lookup by prompt hash
CREATE INDEX idx_image_cache_prompt_hash ON public.image_cache(prompt_hash);

-- Create index for cleanup of old entries
CREATE INDEX idx_image_cache_last_accessed ON public.image_cache(last_accessed_at);

-- Enable RLS
ALTER TABLE public.image_cache ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read from cache (shared cache)
CREATE POLICY "Anyone can read from image cache"
ON public.image_cache
FOR SELECT
USING (true);

-- Allow authenticated users to insert into cache
CREATE POLICY "Authenticated users can insert into cache"
ON public.image_cache
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow system to update access stats
CREATE POLICY "System can update cache stats"
ON public.image_cache
FOR UPDATE
USING (true);

-- Function to clean old cache entries (older than 30 days without access)
CREATE OR REPLACE FUNCTION public.cleanup_old_image_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.image_cache
  WHERE last_accessed_at < now() - interval '30 days';
END;
$$;