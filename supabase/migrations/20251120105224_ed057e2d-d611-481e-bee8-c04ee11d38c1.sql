-- Add background_color column to showcase_sites table
ALTER TABLE showcase_sites 
ADD COLUMN IF NOT EXISTS background_color TEXT DEFAULT '#ffffff';