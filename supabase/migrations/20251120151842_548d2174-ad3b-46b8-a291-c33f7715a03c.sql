-- Add is_preview field to course_modules
ALTER TABLE public.course_modules 
ADD COLUMN is_preview boolean DEFAULT false;

-- Add is_preview field to module_contents
ALTER TABLE public.module_contents 
ADD COLUMN is_preview boolean DEFAULT false;

-- Update RLS policy to allow anyone to view preview modules
CREATE POLICY "Anyone can view preview modules"
ON public.course_modules
FOR SELECT
USING (is_preview = true AND is_published = true);

-- Update RLS policy to allow anyone to view preview contents
CREATE POLICY "Anyone can view preview contents"
ON public.module_contents
FOR SELECT
USING (is_preview = true);