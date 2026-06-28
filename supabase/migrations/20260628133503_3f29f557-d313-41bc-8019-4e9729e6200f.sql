
-- 1. feedback: drop public select policy, add safe view
DROP POLICY IF EXISTS "Users can view published feedback" ON public.feedback;

CREATE OR REPLACE VIEW public.feedback_public
WITH (security_invoker = false) AS
SELECT id, rating, comment, created_at, status, full_name, country, photo_url
FROM public.feedback
WHERE status = 'published';

GRANT SELECT ON public.feedback_public TO anon, authenticated;

-- 2. delivery_providers: restrict to authenticated only (remove anon)
DROP POLICY IF EXISTS "Anyone can view active delivery providers" ON public.delivery_providers;

CREATE POLICY "Authenticated can view active delivery providers"
  ON public.delivery_providers
  FOR SELECT
  TO authenticated
  USING (is_active = true OR auth.uid() = user_id OR has_role(auth.uid(), 'founder'::app_role));

REVOKE SELECT ON public.delivery_providers FROM anon;

-- 3. shop_installed_themes: restrict public read to publicly visible shops
DROP POLICY IF EXISTS "installed_themes_public_read_active" ON public.shop_installed_themes;

CREATE POLICY "installed_themes_public_read_visible_shops"
  ON public.shop_installed_themes
  FOR SELECT
  USING (public.is_shop_publicly_visible(shop_id));
