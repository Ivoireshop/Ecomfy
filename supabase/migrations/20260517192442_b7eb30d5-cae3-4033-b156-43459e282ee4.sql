-- Keep the curated public view security-compliant.
ALTER VIEW public.shops_public SET (security_invoker = on);

-- Public resolver used by storefront pages. It returns only the curated fields
-- from shops_public and bypasses base-table RLS safely through SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.get_public_shop_by_slug(p_slug text)
RETURNS SETOF public.shops_public
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT sp.*
  FROM public.shops_public sp
  WHERE sp.slug = p_slug
    AND COALESCE(sp.is_published, false) = true
    AND COALESCE(sp.is_activated, false) = true
    AND COALESCE(sp.is_suspended, false) = false
  ORDER BY sp.created_at DESC
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_public_shop_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_shop_by_slug(text) TO anon, authenticated;