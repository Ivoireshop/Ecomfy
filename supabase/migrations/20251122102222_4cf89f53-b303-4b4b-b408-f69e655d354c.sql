-- Add customizable statistics fields to showcase_sites
ALTER TABLE showcase_sites 
ADD COLUMN IF NOT EXISTS stats_years_experience INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS stats_satisfied_clients INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS stats_projects_completed INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS stats_show_section BOOLEAN DEFAULT true;

-- Add color control fields for better visibility
ALTER TABLE showcase_sites
ADD COLUMN IF NOT EXISTS navigation_text_color TEXT DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS navigation_bg_color TEXT DEFAULT 'rgba(0,0,0,0.8)',
ADD COLUMN IF NOT EXISTS price_text_color TEXT DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS price_bg_color TEXT DEFAULT '#2563eb',
ADD COLUMN IF NOT EXISTS stats_text_color TEXT DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS stats_bg_color TEXT DEFAULT 'rgba(0,0,0,0.7)';