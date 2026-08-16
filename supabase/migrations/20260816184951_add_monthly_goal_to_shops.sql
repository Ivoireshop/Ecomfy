-- Add monthly_goal column to shops table
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS monthly_goal numeric DEFAULT 1000000;
