-- Add biography_image_position column to showcase_sites table
ALTER TABLE public.showcase_sites
ADD COLUMN biography_image_position TEXT DEFAULT 'left';