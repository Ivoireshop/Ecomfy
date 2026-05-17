-- Ensure public shop links can resolve published/activated shops through RLS.
-- This is required because shops_public is a security-invoker view, so the
-- underlying shops table must explicitly allow public reads for live shops.
DROP POLICY IF EXISTS "Anyone can view published activated shops" ON public.shops;

CREATE POLICY "Anyone can view published activated shops"
ON public.shops
FOR SELECT
TO anon, authenticated
USING (
  COALESCE(is_published, false) = true
  AND COALESCE(is_activated, false) = true
  AND COALESCE(is_suspended, false) = false
);