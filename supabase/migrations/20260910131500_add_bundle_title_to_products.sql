-- Add bundle_title column to products table for custom bundle section titles
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS bundle_title TEXT;
