DROP POLICY IF EXISTS "Anyone can view preview contents" ON public.module_contents;
CREATE POLICY "Anyone can view preview contents"
ON public.module_contents
FOR SELECT
USING (
  is_preview = true
  AND EXISTS (
    SELECT 1 FROM public.course_modules m
    JOIN public.courses c ON c.id = m.course_id
    WHERE m.id = module_contents.module_id
      AND m.is_published = true
      AND c.is_published = true
  )
);