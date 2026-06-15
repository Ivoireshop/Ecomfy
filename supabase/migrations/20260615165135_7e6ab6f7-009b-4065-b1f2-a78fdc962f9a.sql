
-- Drop dependent RPCs first (they return SETOF shops_public)
DROP FUNCTION IF EXISTS public.get_public_shop_by_slug(text);
DROP FUNCTION IF EXISTS public.get_public_shop_by_custom_domain(text);

-- Recreate shops_public WITHOUT user_id and google_analytics_code
DROP VIEW IF EXISTS public.shops_public CASCADE;
CREATE VIEW public.shops_public
WITH (security_invoker = false)
AS
SELECT
  id,
  business_name,
  business_description,
  slug,
  logo_url,
  banner_url,
  primary_color,
  secondary_color,
  theme,
  whatsapp_number,
  phone_number,
  email,
  address,
  city,
  country,
  currency,
  is_activated,
  is_published,
  seo_title,
  seo_description,
  chatbot_enabled,
  chatbot_welcome_message,
  payment_methods,
  favicon_url,
  facebook_pixels,
  tiktok_pixels,
  snapchat_pixels,
  google_analytics_ids,
  checkout_fields,
  cod_delivery_rate,
  theme_config,
  social_proof_enabled,
  tracking_enabled,
  is_suspended,
  delivery_advisor_phone,
  order_confirmation_message,
  custom_domain,
  created_at,
  updated_at
FROM public.shops
WHERE is_published = true
  AND is_activated = true
  AND COALESCE(is_suspended, false) = false;

REVOKE ALL ON public.shops_public FROM PUBLIC;
GRANT SELECT ON public.shops_public TO anon, authenticated;

-- Recreate showcase_sites_public WITHOUT user_id
DROP VIEW IF EXISTS public.showcase_sites_public CASCADE;
CREATE VIEW public.showcase_sites_public
WITH (security_invoker = false)
AS
SELECT
  id,
  subdomain,
  custom_domain,
  business_name,
  business_description,
  owner_name,
  owner_photo_url,
  whatsapp_number,
  phone_number,
  formation_title,
  formation_description,
  formation_price,
  formation_image_url,
  is_published,
  created_at,
  updated_at
FROM public.showcase_sites
WHERE is_published = true;

REVOKE ALL ON public.showcase_sites_public FROM PUBLIC;
GRANT SELECT ON public.showcase_sites_public TO anon, authenticated;

-- Recreate the two RPCs that returned SETOF shops_public
CREATE OR REPLACE FUNCTION public.get_public_shop_by_slug(p_slug text)
RETURNS SETOF public.shops_public
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.shops_public WHERE slug = p_slug LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_public_shop_by_custom_domain(p_domain text)
RETURNS SETOF public.shops_public
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.shops_public WHERE LOWER(custom_domain) = LOWER(p_domain) LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_shop_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_shop_by_custom_domain(text) TO anon, authenticated;
