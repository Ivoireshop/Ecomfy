-- 1) Hide reviewer_email from anonymous (public) readers
REVOKE SELECT (reviewer_email) ON public.product_reviews FROM anon;

-- 2) Convert SECURITY DEFINER view to security_invoker so RLS of caller applies
ALTER VIEW public.shops_public SET (security_invoker = on);