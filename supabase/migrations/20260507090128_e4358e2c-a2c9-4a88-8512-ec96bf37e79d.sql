-- Remove the overly broad policy (exposes sensitive shop columns)
DROP POLICY IF EXISTS "Public can view published shops" ON public.shops;

-- Make shops_public bypass RLS (it already filters to published+activated+non-suspended).
-- This way anonymous visitors can read public shop info via the curated view,
-- without ever exposing sensitive columns from the underlying shops table.
ALTER VIEW public.shops_public SET (security_invoker = false);