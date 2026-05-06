
-- 1. Public view of shops without sensitive financial / token fields
CREATE OR REPLACE VIEW public.shops_public
WITH (security_invoker = true)
AS
SELECT
  id, user_id, business_name, business_description, slug,
  logo_url, banner_url, primary_color, secondary_color, theme,
  whatsapp_number, phone_number, email, address, city, country,
  currency, is_activated, is_published,
  seo_title, seo_description,
  chatbot_enabled, chatbot_welcome_message,
  payment_methods, favicon_url,
  facebook_pixels, tiktok_pixels, snapchat_pixels, google_analytics_ids, google_analytics_code,
  checkout_fields, cod_delivery_rate, theme_config, social_proof_enabled,
  tracking_enabled, is_suspended, delivery_advisor_phone, order_confirmation_message,
  created_at, updated_at
FROM public.shops
WHERE is_published = true AND is_activated = true AND is_suspended = false;

GRANT SELECT ON public.shops_public TO anon, authenticated;

-- Replace the public SELECT policy on shops with owner-only access.
DROP POLICY IF EXISTS "Anyone can view published activated shops" ON public.shops;

-- 2. Validate enrollments insertion (course must exist & be published)
DROP POLICY IF EXISTS "Anyone can create enrollments" ON public.enrollments;
CREATE POLICY "Anyone can create enrollments for published courses"
ON public.enrollments
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id = enrollments.course_id
      AND courses.is_published = true
  )
);

-- 3. Validate showcase analytics insertion
DROP POLICY IF EXISTS "Anyone can insert analytics" ON public.showcase_analytics;
CREATE POLICY "Anyone can insert analytics for valid sites"
ON public.showcase_analytics
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.showcase_sites
    WHERE showcase_sites.id = showcase_analytics.showcase_site_id
  )
);

-- 4. Course modules / module_contents: remove anon-public read
DROP POLICY IF EXISTS "Anyone can view published modules of published courses" ON public.course_modules;
DROP POLICY IF EXISTS "Anyone can view contents of published modules" ON public.module_contents;
-- Keep the "Anyone can view preview modules / contents" policies for previews
-- and the student_access-scoped policies for enrolled students.

-- 5. image_cache INSERT scoped to authenticated user_id
DROP POLICY IF EXISTS "Authenticated users can insert into cache" ON public.image_cache;
CREATE POLICY "Users can insert their own cache entries"
ON public.image_cache
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can insert cache"
ON public.image_cache
FOR INSERT
TO service_role
WITH CHECK (true);

-- 6. shop-images storage: ownership-scoped UPDATE/DELETE
DROP POLICY IF EXISTS "Users can update their own shop images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own shop images" ON storage.objects;

CREATE POLICY "Users can update files in their shop-images folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'shop-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'shop-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete files in their shop-images folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'shop-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
