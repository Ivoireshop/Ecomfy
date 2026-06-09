-- 1) Promo codes: explicit restrictive deny for non-privileged roles.
-- Founder/co-founder ALL policy continues to grant full access; this restrictive
-- policy ensures every SELECT must additionally satisfy the founder check,
-- blocking any accidental exposure via future permissive policies.
DROP POLICY IF EXISTS "Restrict promo_codes reads to founders" ON public.promo_codes;
CREATE POLICY "Restrict promo_codes reads to founders"
ON public.promo_codes
AS RESTRICTIVE
FOR SELECT
TO anon, authenticated
USING (
  public.has_role(auth.uid(), 'founder'::app_role)
  OR public.has_role(auth.uid(), 'co_founder'::app_role)
);

-- 2) shop_visits: only allow inserts for shops that are publicly visible.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'shop_visits' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.shop_visits', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Anyone can record visit for public shops"
ON public.shop_visits
FOR INSERT
TO anon, authenticated
WITH CHECK (public.is_shop_publicly_visible(shop_id));
