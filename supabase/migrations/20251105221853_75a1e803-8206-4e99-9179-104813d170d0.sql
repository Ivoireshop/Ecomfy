-- Add new columns for font customization and theme mode
ALTER TABLE showcase_sites 
ADD COLUMN IF NOT EXISTS font_family TEXT DEFAULT 'poppins',
ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'light';