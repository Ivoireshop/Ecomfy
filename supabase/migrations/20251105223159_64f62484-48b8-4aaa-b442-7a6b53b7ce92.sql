-- Add image_url column to features (stored as JSONB array)
-- We'll update the features structure to include image_url for each feature

-- Add formations array column and text alignment option
ALTER TABLE showcase_sites 
ADD COLUMN IF NOT EXISTS formations JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS formations_text_align TEXT DEFAULT 'center';

-- Add comment for clarity
COMMENT ON COLUMN showcase_sites.formations IS 'Array of formations with title, description, price, and image_url';
COMMENT ON COLUMN showcase_sites.formations_text_align IS 'Text alignment for formations section: left, center, or right';