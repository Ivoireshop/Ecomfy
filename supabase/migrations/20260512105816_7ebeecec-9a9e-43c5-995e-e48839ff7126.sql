ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS selected_variants jsonb;