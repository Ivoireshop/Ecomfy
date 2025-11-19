-- Add hero title customization columns to showcase_sites
ALTER TABLE showcase_sites
ADD COLUMN IF NOT EXISTS hero_title_size INTEGER DEFAULT 48,
ADD COLUMN IF NOT EXISTS hero_title_color TEXT DEFAULT '#000000';