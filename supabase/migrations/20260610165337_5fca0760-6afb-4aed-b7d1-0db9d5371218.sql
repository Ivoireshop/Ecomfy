REVOKE SELECT (domain_verification_code) ON public.showcase_sites FROM anon, authenticated;
REVOKE SELECT (reviewer_email) ON public.product_reviews FROM anon, authenticated;