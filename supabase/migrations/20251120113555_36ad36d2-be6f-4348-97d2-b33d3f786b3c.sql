-- Add footer_color column to showcase_sites table
ALTER TABLE public.showcase_sites
ADD COLUMN footer_color TEXT DEFAULT '#1a1a1a';