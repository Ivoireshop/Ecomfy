
-- 1. generation_queue: only service_role can update
DROP POLICY IF EXISTS "Backend can update queue items" ON public.generation_queue;
CREATE POLICY "Service role can update queue items"
ON public.generation_queue
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- 2. credit_purchases: only service_role can insert
DROP POLICY IF EXISTS "Service can insert credit purchases" ON public.credit_purchases;
CREATE POLICY "Service role can insert credit purchases"
ON public.credit_purchases
FOR INSERT
TO service_role
WITH CHECK (true);

-- 3. referrals: only authenticated owner can insert their own referral
DROP POLICY IF EXISTS "System can insert referrals" ON public.referrals;
CREATE POLICY "Users can create their own referral"
ON public.referrals
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "Service role can insert referrals"
ON public.referrals
FOR INSERT
TO service_role
WITH CHECK (true);

-- 4. image_cache: lock down read & update
DROP POLICY IF EXISTS "Anyone can read from image cache" ON public.image_cache;
DROP POLICY IF EXISTS "System can update cache stats" ON public.image_cache;

CREATE POLICY "Users can read their own cache entries"
ON public.image_cache
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Service role can read all cache"
ON public.image_cache
FOR SELECT
TO service_role
USING (true);

CREATE POLICY "Service role can update cache"
ON public.image_cache
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- 5. course_certificates: remove blanket public select; add narrow lookup function
DROP POLICY IF EXISTS "Anyone can verify certificates by number" ON public.course_certificates;

CREATE OR REPLACE FUNCTION public.verify_certificate_by_number(_certificate_number text)
RETURNS TABLE (
  certificate_number text,
  student_name text,
  course_title text,
  completion_date timestamp with time zone,
  certificate_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT certificate_number, student_name, course_title, completion_date, certificate_url
  FROM public.course_certificates
  WHERE certificate_number = _certificate_number
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_certificate_by_number(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_certificate_by_number(text) TO anon, authenticated;
