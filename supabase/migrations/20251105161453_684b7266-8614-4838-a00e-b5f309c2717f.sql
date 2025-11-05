-- Add AI-generated content fields to showcase_sites table
ALTER TABLE public.showcase_sites 
ADD COLUMN hero_title TEXT,
ADD COLUMN hero_subtitle TEXT,
ADD COLUMN about_title TEXT,
ADD COLUMN about_description TEXT,
ADD COLUMN features JSONB,
ADD COLUMN cta_title TEXT,
ADD COLUMN cta_description TEXT;