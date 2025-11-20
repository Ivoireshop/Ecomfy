-- Add WhatsApp group link field to courses table
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS whatsapp_group_link text;

COMMENT ON COLUMN public.courses.whatsapp_group_link IS 'Lien d''invitation au groupe WhatsApp d''accompagnement de la formation';