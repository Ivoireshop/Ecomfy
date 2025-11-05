-- Add new columns for text customization and layout options
ALTER TABLE showcase_sites 
ADD COLUMN IF NOT EXISTS text_color TEXT DEFAULT '#000000',
ADD COLUMN IF NOT EXISTS about_layout TEXT DEFAULT 'side-by-side',
ADD COLUMN IF NOT EXISTS gallery_text_position TEXT DEFAULT 'below';