-- Create trash table for soft deletes
CREATE TABLE IF NOT EXISTS public.showcase_trash (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  showcase_site_id UUID NOT NULL REFERENCES public.showcase_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  item_type TEXT NOT NULL, -- 'feature', 'formation', 'testimonial', 'gallery_image', 'biography_image', 'logo', 'hero_image', 'about_image'
  item_data JSONB NOT NULL, -- Original data of the deleted item
  storage_path TEXT, -- Storage path if it's an image
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.showcase_trash ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own trash items"
  ON public.showcase_trash
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trash items"
  ON public.showcase_trash
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trash items"
  ON public.showcase_trash
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_showcase_trash_showcase_site_id ON public.showcase_trash(showcase_site_id);
CREATE INDEX idx_showcase_trash_expires_at ON public.showcase_trash(expires_at);
CREATE INDEX idx_showcase_trash_user_id ON public.showcase_trash(user_id);

-- Function to automatically delete expired trash items
CREATE OR REPLACE FUNCTION public.cleanup_expired_trash()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete expired items from trash
  DELETE FROM public.showcase_trash
  WHERE expires_at < now();
END;
$$;

-- Comment on table and columns
COMMENT ON TABLE public.showcase_trash IS 'Soft delete trash bin for showcase items with 30-day retention';
COMMENT ON COLUMN public.showcase_trash.item_type IS 'Type of deleted item: feature, formation, testimonial, gallery_image, biography_image, logo, hero_image, about_image';
COMMENT ON COLUMN public.showcase_trash.item_data IS 'JSON backup of the deleted item data';
COMMENT ON COLUMN public.showcase_trash.storage_path IS 'Original storage path for images to restore';
COMMENT ON COLUMN public.showcase_trash.expires_at IS 'Auto-delete date (30 days from deletion)';
