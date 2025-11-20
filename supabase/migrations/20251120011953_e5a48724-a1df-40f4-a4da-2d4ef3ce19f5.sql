-- Add biography fields to showcase_sites table
ALTER TABLE showcase_sites
ADD COLUMN IF NOT EXISTS biography_title TEXT DEFAULT 'Biographie',
ADD COLUMN IF NOT EXISTS biography_content TEXT,
ADD COLUMN IF NOT EXISTS biography_image_url TEXT,
ADD COLUMN IF NOT EXISTS professional_experience JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN showcase_sites.biography_title IS 'Title for the biography section';
COMMENT ON COLUMN showcase_sites.biography_content IS 'Main biography text content';
COMMENT ON COLUMN showcase_sites.biography_image_url IS 'Image for biography section';
COMMENT ON COLUMN showcase_sites.professional_experience IS 'Array of professional experiences with title, company, period, description';