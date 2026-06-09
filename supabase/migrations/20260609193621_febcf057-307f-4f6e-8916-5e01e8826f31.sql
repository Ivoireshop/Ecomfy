
-- 1. ad_templates: restrict reads to authenticated
DROP POLICY IF EXISTS "Anyone can view active templates" ON public.ad_templates;
CREATE POLICY "Authenticated can view active templates"
  ON public.ad_templates FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 2. bookings: require published showcase site
DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;
CREATE POLICY "Anyone can create bookings for published sites"
  ON public.bookings FOR INSERT
  TO anon, authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.showcase_sites
    WHERE showcase_sites.id = bookings.showcase_site_id
      AND showcase_sites.is_published = true
  ));

-- 3. contact_submissions: require published site
DROP POLICY IF EXISTS "Anyone can submit contact forms" ON public.contact_submissions;
CREATE POLICY "Anyone can submit contact forms for published sites"
  ON public.contact_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.showcase_sites
    WHERE showcase_sites.id = contact_submissions.showcase_site_id
      AND showcase_sites.is_published = true
  ));

-- 4. course_inquiries: require published course
DROP POLICY IF EXISTS "Anyone can create inquiries" ON public.course_inquiries;
CREATE POLICY "Anyone can create inquiries for published courses"
  ON public.course_inquiries FOR INSERT
  TO anon, authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id = course_inquiries.course_id
      AND courses.is_published = true
  ));

-- 5. shop_collaborators: hide invitation_token from API readers via column-level revoke
REVOKE SELECT (invitation_token) ON public.shop_collaborators FROM anon, authenticated;
