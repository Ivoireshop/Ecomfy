
-- Add user_id to courses table
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS user_id uuid;

-- Populate user_id from existing showcase_sites
UPDATE public.courses 
SET user_id = ss.user_id 
FROM public.showcase_sites ss 
WHERE courses.showcase_site_id = ss.id 
AND courses.user_id IS NULL;

-- Make showcase_site_id nullable
ALTER TABLE public.courses ALTER COLUMN showcase_site_id DROP NOT NULL;

-- Make enrollments.showcase_site_id nullable  
ALTER TABLE public.enrollments ALTER COLUMN showcase_site_id DROP NOT NULL;

-- Drop old RLS policies on courses
DROP POLICY IF EXISTS "Site owners can manage their courses" ON public.courses;
DROP POLICY IF EXISTS "Anyone can view published courses" ON public.courses;

-- New RLS policies for courses
CREATE POLICY "Owners can manage their courses" 
ON public.courses FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view published courses" 
ON public.courses FOR SELECT 
USING (is_published = true);

-- Drop old RLS policies on enrollments
DROP POLICY IF EXISTS "Site owners can view and manage enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Anyone can create enrollments" ON public.enrollments;

-- New RLS policies for enrollments
CREATE POLICY "Course owners can manage enrollments" 
ON public.enrollments FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.courses 
    WHERE courses.id = enrollments.course_id 
    AND courses.user_id = auth.uid()
  )
);

CREATE POLICY "Anyone can create enrollments" 
ON public.enrollments FOR INSERT 
WITH CHECK (true);

-- Update course_modules RLS to also check course user_id
DROP POLICY IF EXISTS "Site owners can manage modules" ON public.course_modules;

CREATE POLICY "Course owners can manage modules" 
ON public.course_modules FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.courses 
    WHERE courses.id = course_modules.course_id 
    AND courses.user_id = auth.uid()
  )
);

-- Update module_contents RLS
DROP POLICY IF EXISTS "Site owners can manage contents" ON public.module_contents;

CREATE POLICY "Course owners can manage contents" 
ON public.module_contents FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.course_modules m
    JOIN public.courses c ON c.id = m.course_id
    WHERE m.id = module_contents.module_id 
    AND c.user_id = auth.uid()
  )
);

-- Update payment_links RLS
DROP POLICY IF EXISTS "Site owners can manage payment links" ON public.payment_links;

CREATE POLICY "Course owners can manage payment links" 
ON public.payment_links FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.courses 
    WHERE courses.id = payment_links.course_id 
    AND courses.user_id = auth.uid()
  )
);

-- Update course_certificates RLS
DROP POLICY IF EXISTS "Site owners can view certificates for their courses" ON public.course_certificates;

CREATE POLICY "Course owners can view certificates" 
ON public.course_certificates FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.courses 
    WHERE courses.id = course_certificates.course_id 
    AND courses.user_id = auth.uid()
  )
);

-- Update course_inquiries RLS
DROP POLICY IF EXISTS "Site owners can view and manage inquiries" ON public.course_inquiries;

CREATE POLICY "Course owners can manage inquiries" 
ON public.course_inquiries FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.courses 
    WHERE courses.id = course_inquiries.course_id 
    AND courses.user_id = auth.uid()
  )
);
