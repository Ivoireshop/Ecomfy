-- Migration to add CTA customization options to shops table

ALTER TABLE public.shops 
ADD COLUMN cta_animation_type text DEFAULT 'pulse',
ADD COLUMN cta_animation_speed text DEFAULT 'normal';

-- Add comments for postgrest reflection
COMMENT ON COLUMN public.shops.cta_animation_type IS 'Animation type for the main call to action button (pulse, shake, slide, bounce, static)';
COMMENT ON COLUMN public.shops.cta_animation_speed IS 'Animation speed for the main call to action button (slow, normal, fast)';
