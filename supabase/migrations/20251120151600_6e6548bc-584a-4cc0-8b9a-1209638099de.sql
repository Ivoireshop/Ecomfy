-- Add policy to allow public viewing of published course modules
CREATE POLICY "Anyone can view published modules of published courses"
ON public.course_modules
FOR SELECT
USING (
  is_published = true 
  AND EXISTS (
    SELECT 1 FROM courses 
    WHERE courses.id = course_modules.course_id 
    AND courses.is_published = true
  )
);

-- Add policy to allow public viewing of module contents for published modules
CREATE POLICY "Anyone can view contents of published modules"
ON public.module_contents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM course_modules m 
    JOIN courses c ON c.id = m.course_id
    WHERE m.id = module_contents.module_id 
    AND m.is_published = true 
    AND c.is_published = true
  )
);