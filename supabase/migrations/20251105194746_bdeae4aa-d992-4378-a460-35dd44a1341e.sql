-- Add theme fields to showcase_sites table
ALTER TABLE public.showcase_sites
ADD COLUMN theme text DEFAULT 'professional',
ADD COLUMN primary_color text DEFAULT '#2563eb',
ADD COLUMN secondary_color text DEFAULT '#7c3aed';