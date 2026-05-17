-- The previous fix made live shops readable from the base table, which can
-- expose internal shop columns through direct API calls. Keep public access
-- constrained to the curated shops_public view instead.
DROP POLICY IF EXISTS "Anyone can view published activated shops" ON public.shops;

ALTER VIEW public.shops_public SET (security_invoker = false);