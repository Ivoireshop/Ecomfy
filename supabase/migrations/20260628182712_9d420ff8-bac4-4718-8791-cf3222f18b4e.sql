-- Restrict delivery_providers full row access and expose only safe fields via a view.

DROP POLICY IF EXISTS "Authenticated can view active delivery providers" ON public.delivery_providers;

CREATE POLICY "Owners and founders read delivery provider"
ON public.delivery_providers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'founder'::app_role));

-- Public, contact-stripped view for merchants browsing the directory.
CREATE OR REPLACE VIEW public.delivery_providers_public
WITH (security_invoker = false) AS
SELECT
  id,
  company_name,
  slug,
  city,
  coverage_areas,
  description,
  logo_url,
  base_price,
  is_recommended,
  is_verified,
  is_active,
  created_at,
  updated_at
FROM public.delivery_providers
WHERE is_active = true;

GRANT SELECT ON public.delivery_providers_public TO authenticated;
GRANT SELECT ON public.delivery_providers_public TO anon;