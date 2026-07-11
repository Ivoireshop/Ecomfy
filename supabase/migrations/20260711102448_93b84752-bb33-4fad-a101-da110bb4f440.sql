DROP POLICY IF EXISTS "Anyone can view preview modules" ON public.course_modules;

CREATE POLICY "Anyone can view preview modules"
ON public.course_modules
FOR SELECT
USING (
  is_preview = true
  AND is_published = true
  AND EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = course_modules.course_id
      AND c.is_published = true
  )
);